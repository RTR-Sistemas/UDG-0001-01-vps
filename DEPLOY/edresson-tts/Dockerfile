# =============================================================================
# Servidor de voz Edresson/Coqui para o UndoinG
#
#   docker build -t udg-voz .
#   docker run -d --name udg-voz --restart unless-stopped \
#     -p 127.0.0.1:8080:8080 \
#     -e TTS_MODEL="tts_models/pt/cv/vits" \
#     -e TTS_TOKEN="troque-este-token" \
#     -v udg-voz-models:/root/.local/share/tts \
#     udg-voz
#
# O volume guarda os pesos baixados: sem ele, cada restart baixa tudo de novo.
# =============================================================================
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    COQUI_TOS_AGREED=1 \
    PORT=8080

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg espeak-ng git curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
# CPU-only: a roda de CPU do torch é ~5x menor que a versão com CUDA.
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch==2.5.1 \
 && pip install -r requirements.txt

COPY server.py .

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=5 \
  CMD curl -fsS http://127.0.0.1:8080/health || exit 1

CMD ["python", "server.py"]
