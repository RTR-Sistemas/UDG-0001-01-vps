"""
=============================================================================
Servidor de voz "Edresson / Coqui TTS-Portuguese" para o UndoinG.

Por que existe
--------------
O painel de dublagem tenta primeiro CLONAR a voz do usuário (XTTS-v2). Se
essa tentativa não terminar em 3 segundos, o pipeline cai para a "voz da
casa" — é este servidor.

O projeto TTS-Portuguese (Edresson Casanova) publica checkpoints do Coqui
TTS, e não modelos servidos pela API pública da Hugging Face (lá o autor só
mantém modelos de ASR/wav2vec2). Ou seja: para usar essa voz é preciso um
processo rodando em algum lugar — esta é a peça que faltava.

O que expõe
-----------
  GET  /health          → { ok, model, device }
  POST /                → { text, language, speaker_wav? }  → audio/wav
  POST /tts             → idem (alias)

O corpo aceita `speaker_wav` em base64: quando vem preenchido e o modelo
carregado suporta clonagem (XTTS-v2), a voz sai parecida com a do usuário.

Configuração (variáveis de ambiente)
------------------------------------
  TTS_MODEL     modelo Coqui a carregar.
                padrão: "tts_models/multilingual/multi-dataset/xtts_v2"
                alternativa 100% pt-BR e bem mais leve:
                "tts_models/pt/cv/vits"   ← treinado no Common Voice PT
  TTS_TOKEN     se definido, exige "Authorization: Bearer <token>"
  TTS_DEVICE    "cuda" ou "cpu" (padrão: detecta)
  PORT          padrão 8080

Como o app usa
--------------
Nos secrets das Edge Functions do Supabase:
  EDRESSON_TTS_URL=https://voz.seudominio.com.br/tts
  EDRESSON_TTS_TOKEN=<o mesmo TTS_TOKEN, se usar>
=============================================================================
"""

import base64
import io
import os
import tempfile
import threading

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

MODEL_NAME = os.getenv("TTS_MODEL", "tts_models/multilingual/multi-dataset/xtts_v2")
TTS_TOKEN = os.getenv("TTS_TOKEN", "").strip()
PORT = int(os.getenv("PORT", "8080"))

# Idiomas aceitos pelo XTTS-v2. Modelos monolíngues ignoram o parâmetro.
XTTS_LANGUAGES = {
    "pt", "en", "es", "fr", "de", "it", "pl", "tr", "ru",
    "nl", "cs", "ar", "zh", "hu", "ko", "ja", "hi",
}

app = FastAPI(title="UndoinG · Edresson/Coqui TTS", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_tts = None
_lock = threading.Lock()
_device = "cpu"


def get_tts():
    """Carrega o modelo uma única vez (o primeiro pedido paga o custo)."""
    global _tts, _device
    if _tts is not None:
        return _tts
    with _lock:
        if _tts is not None:
            return _tts
        import torch  # importado aqui para o /health responder antes do modelo
        from TTS.api import TTS

        _device = os.getenv("TTS_DEVICE") or ("cuda" if torch.cuda.is_available() else "cpu")
        _tts = TTS(MODEL_NAME).to(_device)
        return _tts


def check_auth(authorization: str | None):
    if not TTS_TOKEN:
        return
    expected = f"Bearer {TTS_TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Token inválido.")


@app.get("/health")
def health():
    return JSONResponse(
        {
            "ok": True,
            "model": MODEL_NAME,
            "device": _device,
            "loaded": _tts is not None,
            "auth": bool(TTS_TOKEN),
        }
    )


@app.post("/")
@app.post("/tts")
async def synthesize(request: Request, authorization: str | None = Header(default=None)):
    check_auth(authorization)

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Corpo JSON inválido.")

    text = (body.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail='O campo "text" é obrigatório.')
    if len(text) > 1200:
        text = text[:1200]

    language = (body.get("language") or "pt").split("-")[0].lower()
    speaker_wav_b64 = body.get("speaker_wav") or ""

    tts = get_tts()
    kwargs = {"text": text}

    is_multilingual = getattr(tts, "is_multi_lingual", False)
    if is_multilingual:
        kwargs["language"] = language if language in XTTS_LANGUAGES else "pt"

    # Só modelos de clonagem (XTTS) aceitam `speaker_wav`. Mandar esse
    # parâmetro para um VITS monofalante levanta TypeError e derruba o pedido.
    supports_clone = "xtts" in MODEL_NAME.lower() or getattr(tts, "is_multi_speaker", False)

    reference_path = None
    try:
        if speaker_wav_b64 and supports_clone:
            raw = speaker_wav_b64.split(",", 1)[-1]
            audio_bytes = base64.b64decode(raw)
            # O Coqui aceita qualquer formato que o ffmpeg/soundfile leia.
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio_bytes)
                reference_path = tmp.name
            kwargs["speaker_wav"] = reference_path
        elif getattr(tts, "is_multi_speaker", False):
            speakers = getattr(tts, "speakers", None) or []
            if speakers:
                kwargs["speaker"] = speakers[0]

        buffer = io.BytesIO()
        tts.tts_to_file(file_path=buffer, **kwargs)
        data = buffer.getvalue()
    except TypeError:
        # Versões antigas do Coqui não escrevem em file-like: usa arquivo real.
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as out:
            out_path = out.name
        tts.tts_to_file(file_path=out_path, **kwargs)
        with open(out_path, "rb") as fh:
            data = fh.read()
        os.unlink(out_path)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Falha na síntese: {exc}") from exc
    finally:
        if reference_path and os.path.exists(reference_path):
            os.unlink(reference_path)

    if not data:
        raise HTTPException(status_code=500, detail="Síntese vazia.")

    return Response(content=data, media_type="audio/wav")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=PORT)
