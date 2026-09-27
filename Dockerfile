# Marktplaats Watcher: React UI + FastAPI + LangChain agent in one container.
# Secrets are NOT baked in: pass them at run time with  --env-file .env
# The UI needs two PUBLIC values at build time:
#   docker build --build-arg VITE_CONVEX_URL=... --build-arg VITE_CLERK_PUBLISHABLE_KEY=... .

# Stage 1: build the React UI
FROM node:22-slim AS ui
WORKDIR /ui
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
ARG VITE_CONVEX_URL
ARG VITE_CLERK_PUBLISHABLE_KEY
RUN npm run build

# Stage 2: the Python app, which serves the API and the built UI on port 8000
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
# uv (pinned) instead of pip: same resolver as local development, and pip trips over a
# malformed version string on PyPI
RUN pip install --no-cache-dir uv==0.11.8 && uv pip install --system --no-cache -r requirements.txt
COPY agent.py main.py ./
COPY --from=ui /ui/dist ./frontend/dist
# Least privilege: run as an unprivileged user, not root
RUN useradd --create-home --uid 10001 agent
USER agent
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4)"
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
