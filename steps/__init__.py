"""The agent graph's steps, one file per stage. Each wraps logic from a top-level module as a graph step:

route.py      -> routing.py      the router's reading of the question, and the scope check
key_stats.py  -> key_stats.py    up to 2 key statistics, given to the agent before it answers
react.py      -> tools.py        the ReAct loop: the agent decides, the tools act
verify.py     -> verifier.py     checks, one repair attempt, then removal of what still fails
"""
