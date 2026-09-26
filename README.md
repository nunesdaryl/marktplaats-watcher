# Marktplaats Watcher (MVP)

A chat agent that searches Marktplaats.nl: React chat UI → FastAPI `POST /api/chat` →
LangChain agent loop on Azure AI Foundry → one tool, `search_marktplaats`.

| file | what it is |
|---|---|
| `.env` | Azure AI Foundry endpoint, key and deployment name. **Never commit.** Copy from `.env.example`. |
| `agent.py` | The tool, the model and the agent loop (`chat`). |
| `main.py` | FastAPI server with one route, `POST /api/chat`. |
| `frontend/src/App.jsx` | React chat box. |
| `requirements.txt` | Pinned Python dependencies (LangChain + Azure, FastAPI). |
| `test_agent.py` | Offline tests for the page parser (no model, no network). |

## Run it
```bash
cp .env.example .env            # fill in from the Foundry portal (base URL ends in /openai/v1)
uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/uvicorn main:app --port 8000
cd frontend && npm install && npm run dev      # http://localhost:5173
```
Tests: `.venv/bin/python -m pytest -q`

## Limits
- It fetches only the public `/q/` search page, which robots.txt allows. It never uses `/lrp/api/`.
  One page is fetched per search, and seller details are never kept.
- Marktplaats' terms (Art. 7.3) forbid repeated, systematic querying. This is for personal demo use only.
