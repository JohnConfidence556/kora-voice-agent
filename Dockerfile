FROM python:3.10-slim

# libgomp1 is needed by faiss and onnxruntime
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    FASTEMBED_CACHE_PATH=/opt/fastembed

WORKDIR /app

COPY backend/requirements.deploy.txt backend/requirements.deploy.txt
RUN pip install --no-cache-dir -r backend/requirements.deploy.txt

COPY backend backend
COPY data data

WORKDIR /app/backend

# Bake the embedding model AND the knowledge-base index into the image,
# so the server never downloads or embeds anything when it starts.
RUN python -c "from rag import Retriever; Retriever()"
# Same for the voice-activity model the agent uses
RUN python -c "from livekit.plugins import silero; silero.VAD.load()"

# docker-compose.yml decides which command each container runs
