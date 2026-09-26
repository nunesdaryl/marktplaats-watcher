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

## Run it with Docker (for anyone)
One container serves the chat UI and the API on port 8000. Secrets are **not** in the image;
each user supplies their own `.env` (copy `.env.example` and fill in their Azure values).

```bash
# Build (on this Mac)
docker build -t marktplaats-watcher:1.0 .                                  # Apple Silicon (arm64)
docker build --platform linux/amd64 -t marktplaats-watcher:1.0-amd64 .     # Intel / most servers

# Export to a file you can share
docker save marktplaats-watcher:1.0 | gzip > marktplaats-watcher-1.0-arm64.tar.gz

# Import and run anywhere
docker load < marktplaats-watcher-1.0-arm64.tar.gz
docker run -d --name marktplaats-watcher --env-file .env -p 127.0.0.1:8000:8000 marktplaats-watcher:1.0
# open http://localhost:8000
```
Pick the file that matches the machine: `arm64` for Apple Silicon, `amd64` for Intel Macs, Windows and
most Linux/cloud servers. The container runs as a non-root user and reports its health at `/api/health`.

## Limits
- The tool reads the first results page only (about 30 listings). A distance filter keeps only listings
  that have a location, which is roughly a third of them; many private sellers show no location there.
  Postcode to coordinates uses PDOK, the Dutch government's free address service.
- It fetches only the public `/q/` search page, which robots.txt allows. It never uses `/lrp/api/`.
  One page is fetched per search, and seller details are never kept.
- Marktplaats' terms (Art. 7.3) forbid repeated, systematic querying. This is for personal demo use only.
