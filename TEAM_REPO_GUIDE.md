# How to use the AquaMaa repository

For Deema, Mais and Munira. Repository: https://github.com/Roaa0Ibrahim/AquaMaa (private).
Your milestones: [TEAM_PLAN.md](TEAM_PLAN.md).

## The rules (everyone)
1. **Work on your own branch, never on `main`.** `main` is the checked version of the agent; Roaa merges into it.
2. **Push often.** Your work is then saved on GitHub, and the others can see it.
3. **Never commit passwords or keys,** such as the database key. Put them in a file called `.env` in your folder; Git ignores it.
4. **Don't commit large build files:** `vector_store.json`, `chunks.jsonl`, `node_modules/`, Android `build/` folders. Git already ignores them.
5. **When a milestone's check passes,** open a pull request from your branch on GitHub and tell Roaa.

## One-time setup
1. Accept the email invitation to the repository. No invitation? Ask Roaa to add you (GitHub → Settings → Collaborators).
2. Install **GitHub Desktop** (https://desktop.github.com). It does everything below with buttons, no commands.
3. In GitHub Desktop: File → Clone repository → `Roaa0Ibrahim/AquaMaa`.
4. Make your branch: Current branch → New branch → the name given below for you → based on `main`, or on `deema-development` for Deema.

## Every time you work
1. **Fetch origin** and **Pull**: get the latest changes first.
2. Work on your files.
3. Write a short summary of what you did, then **Commit to your branch**.
4. **Push origin.**

Command-line version, if you prefer: `git pull` · `git add <files>` · `git commit -m "what I did"` · `git push`.

## Mais: knowledge and answers
- **Branch:** `mais-knowledge`
- **You already built the knowledge base,** so you can run the agent (`python agent.py "question"`) to see how it answers. Pull `main` first so your copy is up to date.
- **Knowledge Milestone 1:** `knowledge/expected_questions.csv`, with the columns `user` (officer, farmer, visitor), `question`, `answerable` (yes, partly, no), `source` (file and page, or "missing") and `note`
- **Knowledge Milestone 2:** `knowledge/answer_style.md`: the draft simplification prompt, how answers are delivered (length, tone, spoken by Pepper or written), and 5 example questions with good answers
- **Knowledge Milestone 3:** each new source goes in the right `database/` folder as a `.txt` or `.csv` file, plus an entry in `database/sources.json` (copy an existing entry and change it: title, publisher, link, licence). Then rebuild and check:
  - `python build_kb.py`: rebuilds the knowledge base (about a minute)
  - `python eval_kb.py`: checks that the 10 test questions still find their files
  - commit the new source files and `sources.json`, not the rebuilt files
- `knowledge_base_questions.json` is your own file, as before.

## Deema: website
- **Branch:** keep using `deema-development`. It stays yours.
- **The chat panel:** the `chat-widget` branch adds the "Ask AquaMaa" chat to your website. Please review it on GitHub (Pull requests → chat-widget) and merge it when you're happy with it.
- **The database:** keep its link and key in `.env`, never in the code you commit.
- You don't need Python, Ollama or the knowledge base. The AI agent runs on Roaa's laptop.

## Munira: sensors and robot
- **Branch:** `munira-robot`
- **The ESP32 code:** put it in a folder called `sensors/`, without the Wi-Fi password or the database key (use a separate `secrets.h`, which Git ignores).
- **Pepper:** copy Ala's `PepperWaterQuality` project into a folder called `pepper/`, then open `pepper/PepperWaterQuality` in Android Studio. Commit your changes to the `.kt`, `.top` and `.xml` files; the build folders are ignored.
- You don't need Python, Ollama or the knowledge base. When Pepper needs the AI agent, it calls Roaa's laptop over the lab Wi-Fi.

## If something goes wrong
| Problem | What to do |
|---|---|
| "Repository not found" | You haven't accepted the invitation yet, or you're signed in with another GitHub account |
| Push rejected | Pull first, then push again |
| A conflict when pulling | Don't force anything; send Roaa a screenshot |
| You committed a key by mistake | Tell Roaa straight away; the key must be changed, as deleting the file doesn't remove it from the history |
