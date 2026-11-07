# 0. Logging: progress goes to the screen and to agent.log, answers stay on stdout
import logging
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(), logging.FileHandler("agent.log", encoding="utf-8")],
)
logging.getLogger("httpx").setLevel(logging.WARNING)  # hide one line per HTTP call
log = logging.getLogger("agentic_rag")

# 1. Preprocess documents
import requests
from bs4 import BeautifulSoup
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

urls = [
    "https://lilianweng.github.io/posts/2024-11-28-reward-hacking/",
    "https://lilianweng.github.io/posts/2024-07-07-hallucination/",
    "https://lilianweng.github.io/posts/2024-04-12-diffusion-video/",
]

def load(url):
    html = requests.get(url, timeout=30).text
    text = BeautifulSoup(html, "html.parser").get_text(separator="\n", strip=True)
    log.info("Loaded %s (%d characters)", url, len(text))
    return Document(page_content=text, metadata={"source": url})

docs = [load(url) for url in urls]

splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
    chunk_size=100, chunk_overlap=50
)
doc_splits = splitter.split_documents(docs)
log.info("Split %d documents into %d chunks", len(docs), len(doc_splits))

# 2. Create the retriever tool (swap 1: local embeddings)

from langchain_core.tools import tool
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_ollama import OllamaEmbeddings

# Embed in small batches, so one Ollama hiccup costs one batch, not the whole run.
BATCH = 50
vectorstore = InMemoryVectorStore(embedding=OllamaEmbeddings(model="bge-m3"))
start = time.time()
for i in range(0, len(doc_splits), BATCH):
    batch = doc_splits[i : i + BATCH]
    for attempt in (1, 2):
        try:
            vectorstore.add_documents(batch)
            break
        except Exception as error:
            log.warning("Embedding batch %d failed (attempt %d): %s", i // BATCH + 1, attempt, error)
            if attempt == 2:
                raise
            time.sleep(3)
    log.info("Embedded %d/%d chunks", min(i + BATCH, len(doc_splits)), len(doc_splits))
log.info("Embedding finished in %.1f s", time.time() - start)
retriever = vectorstore.as_retriever()

@tool
def retrieve_blog_posts(query: str) -> str:
    """Search and return information about Lilian Weng blog posts."""
    results = retriever.invoke(query)
    log.info("RETRIEVE query=%r -> %d chunks", query, len(results))
    return "\n\n".join(doc.page_content for doc in results)

retriever_tool = retrieve_blog_posts


# 3. Generate a query or respond (swap 2: local Qwen)
from langchain_ollama import ChatOllama
from langgraph.graph import MessagesState

response_model = ChatOllama(model="qwen3:14b", temperature=0, reasoning=False)

def generate_query_or_respond(state: MessagesState):
    start = time.time()
    response = response_model.bind_tools([retriever_tool]).invoke(state["messages"])
    if response.tool_calls:
        log.info("DECIDE: search, args=%s (%.1f s)", response.tool_calls[0]["args"], time.time() - start)
    else:
        log.info("DECIDE: answer directly, no search (%.1f s)", time.time() - start)
    return {"messages": [response]}


# 4. Grade documents
from typing import Literal
from pydantic import BaseModel, Field

# Adapted from ai2-scholarqa-lib SYSTEM_PROMPT_QUOTE_PER_PAPER (Apache 2.0)
QUOTE_PROMPT = (
    "Question: {question}\n\nText:\n<<<\n{context}\n>>>\n\n"
    "Copy the EXACT sentences from the text that help answer the question. "
    "Copy text only. Do not explain. Use ... between separate pieces. "
    "If nothing helps, output None."
)

class Quote(BaseModel):
    """Exact text that answers the question, or None."""
    quote: str = Field(description="Exact sentences copied from the text, or 'None'")

grader_model = ChatOllama(model="qwen3:14b", temperature=0, reasoning=False)

def normalize(text):
    return " ".join(text.split())  # ignore differences in spaces and line breaks

def grade_documents(state: MessagesState) -> Literal["generate_answer", "rewrite_question"]:
    question = state["messages"][0].content
    context = state["messages"][-1].content
    prompt = QUOTE_PROMPT.format(question=question, context=context)
    result = grader_model.with_structured_output(Quote).invoke(
        [{"role": "user", "content": prompt}]
    )
    pieces = [normalize(p) for p in result.quote.split("...") if p.strip()]
    verified = result.quote.strip() != "None" and all(p in normalize(context) for p in pieces)
    log.info("QUOTE verified=%s: %r", verified, result.quote[:150])

    already_rewritten = any(getattr(m, "name", None) == "rewrite" for m in state["messages"])
    if verified or already_rewritten:
        return "generate_answer"
    return "rewrite_question"


# 5. Rewrite the question

import uuid
from langchain_core.messages import AIMessage

class RewrittenQuestion(BaseModel):
    """A clearer search query."""
    question: str = Field(description="The rewritten question only, with no explanation")

REWRITE_PROMPT = (
    "Rewrite this question so it works better as a document search query. "
    "Keep its meaning.\n\nQuestion: {question}"
)

def rewrite_question(state: MessagesState):
    question = state["messages"][0].content
    result = response_model.with_structured_output(RewrittenQuestion).invoke(
        [{"role": "user", "content": REWRITE_PROMPT.format(question=question)}]
    )
    log.info("REWRITE: %r", result.question)
    # Send the search directly, so the model can't answer from memory
    search = AIMessage(
        content="",
        name="rewrite",
        tool_calls=[{
            "name": "retrieve_blog_posts",
            "args": {"query": result.question},
            "id": f"rewrite-{uuid.uuid4().hex[:8]}",
        }],
    )
    return {"messages": [search]}


# 6. Generate the answer
GENERATE_PROMPT = (
    "You are an assistant for question-answering tasks. "
    "Use the following pieces of retrieved context to answer the question. "
    "If you don't know the answer, just say that you don't know. "
    "Use three sentences maximum and keep the answer concise.\n"
    "Question: {question}\n"
    "Context: {context}"
)

def generate_answer(state: MessagesState):
    question = state["messages"][0].content
    context = state["messages"][-1].content
    prompt = GENERATE_PROMPT.format(question=question, context=context)
    start = time.time()
    response = response_model.invoke([{"role": "user", "content": prompt}])
    log.info("ANSWER generated (%.1f s)", time.time() - start)
    return {"messages": [response]}

# 7. Assemble the graph
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode, tools_condition

workflow = StateGraph(MessagesState)
workflow.add_node(generate_query_or_respond)
workflow.add_node("retrieve", ToolNode([retriever_tool]))
workflow.add_node(rewrite_question)
workflow.add_node(generate_answer)

workflow.add_edge(START, "generate_query_or_respond")
workflow.add_conditional_edges(
    "generate_query_or_respond",
    tools_condition,
    {"tools": "retrieve", END: END},
)
workflow.add_conditional_edges("retrieve", grade_documents)
workflow.add_edge("generate_answer", END)
workflow.add_edge("rewrite_question", "retrieve")

graph = workflow.compile()

# 8. Run it

for question in [
    "hello!",
    "What does Lilian Weng say about types of reward hacking?",
    "What does Lilian Weng say about cooking pasta?",
]:
    log.info("QUESTION: %s", question)
    for chunk in graph.stream(
        {"messages": [{"role": "user", "content": question}]}, stream_mode="values"
    ):
        chunk["messages"][-1].pretty_print()


