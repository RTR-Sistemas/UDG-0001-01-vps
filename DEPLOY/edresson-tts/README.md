# Voz Edresson / Coqui — servidor de TTS do UndoinG

Este diretório publica a **"voz da casa"**: a voz que entra quando a clonagem
da voz do próprio usuário (XTTS-v2 pela Hugging Face) não responde em
**3 segundos**.

---

## Por que ela precisa de um servidor

O projeto **TTS-Portuguese**, do Edresson Casanova, distribui *checkpoints do
Coqui TTS* — não modelos servidos pela API pública da Hugging Face. No perfil
`Edresson` do Hugging Face só existem modelos de **ASR** (wav2vec2); nenhum de
`text-to-speech`. E o `coqui/XTTS-v2` também não é servido pelo provider
`hf-inference` (é um modelo da biblioteca Coqui, não do `transformers`).

Conclusão prática: **não existe endpoint gratuito e pronto** para essa voz.
Para tê-la é preciso um processo rodando — e é exatamente isso que está aqui.

Enquanto esse servidor não estiver de pé, a dublagem **continua funcionando**:
a cascata cai para as vozes neurais da Amazon Polly (Camila / Ricardo em
pt-BR), que são gratuitas, não precisam de chave e soam naturais.

---

## Cascata de vozes (como o app decide)

```
texto traduzido
   │
   ├─ 1. XTTS-v2 (clonagem da sua voz) ......... corte duro em 3 s
   │      ↳ a retaguarda já está sendo gerada em paralelo,
   │        então esses 3 s NÃO viram espera extra
   │
   ├─ 2. Edresson / Coqui (ESTE servidor) ...... só se EDRESSON_TTS_URL existir
   │
   ├─ 3. ElevenLabs ........................... só se a chave tiver permissão
   │
   ├─ 4. Amazon Polly via StreamElements ....... só com STREAMELEMENTS_JWT
   │
   └─ 5. Google Translate TTS .................. último recurso
```

A ordem de 2 a 5 é configurável em `TTS_ORDER`
(ex.: `TTS_ORDER="elevenlabs,edresson,google"`).

### Duas descobertas de 29/08/2026 (testadas em produção)

1. **StreamElements passou a exigir chave.** A chamada anônima que o código
   fazia responde `401 {"error":"Unauthorized","message":"No API key was
   found"}`. Era por isso que TODA dublagem estava saindo na voz do Google:
   a camada "Camila / Ricardo" morria em silêncio. Agora esse provedor só é
   tentado quando existe `STREAMELEMENTS_JWT`, e a chamada leva o
   `Authorization: Bearer`.

2. **A chave do ElevenLabs está sem a permissão `text_to_speech`.** A conta
   existe e é do plano *free* com 10.000 caracteres/mês **ainda intactos**
   (`character_count: 0`), mas a chave devolve:
   `"The API key you used is missing the permission text_to_speech"`.
   Correção: elevenlabs.io → *Profile → API Keys* → gerar uma chave nova com
   `text_to_speech` marcado → atualizar `ELEVENLABS_API_KEY` nos secrets.
   É o caminho mais rápido para uma voz realmente natural, sem VPS nenhuma.

---

## Subir na VPS da Hostinger (Docker)

```bash
# 1. Enviar a pasta para o servidor
scp -r deploy/edresson-tts root@187.127.51.179:/opt/udg-voz

# 2. Construir e rodar
ssh root@187.127.51.179
cd /opt/udg-voz
docker build -t udg-voz .
docker run -d --name udg-voz --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -e TTS_MODEL="tts_models/pt/cv/vits" \
  -e TTS_TOKEN="TROQUE-ESTE-TOKEN" \
  -v udg-voz-models:/root/.local/share/tts \
  udg-voz

# 3. Conferir (a primeira chamada baixa o modelo: pode levar alguns minutos)
curl -s http://127.0.0.1:8080/health
curl -s -X POST http://127.0.0.1:8080/tts \
  -H "Authorization: Bearer TROQUE-ESTE-TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Bom dia, isso é um teste de voz.","language":"pt"}' \
  --output teste.wav && ls -lh teste.wav
```

### Qual modelo escolher

| `TTS_MODEL` | RAM | Velocidade (CPU) | Clona voz | Observação |
|---|---|---|---|---|
| `tts_models/pt/cv/vits` | ~1,5 GB | ~1-2 s | ❌ | **Recomendado para VPS sem GPU.** Voz pt-BR do Common Voice, na linha do TTS-Portuguese. |
| `tts_models/multilingual/multi-dataset/xtts_v2` | ~6 GB | 15-40 s | ✅ | Só vale a pena com GPU. Em CPU estoura qualquer prazo razoável. |

> Em VPS sem GPU use o **VITS pt-BR**. A clonagem continua sendo tentada antes,
> pela Hugging Face, com o corte de 3 segundos.

### Nginx (expor com HTTPS)

```nginx
location /voz/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_read_timeout 60s;
    proxy_set_header Host $host;
    client_max_body_size 12m;
}
```

---

## Ligar no aplicativo

Nos **secrets das Edge Functions** do Supabase (projeto `ipmldkprqdhybedhpgmt`):

```bash
supabase secrets set \
  EDRESSON_TTS_URL="https://udgservidor.online/voz/tts" \
  EDRESSON_TTS_TOKEN="TROQUE-ESTE-TOKEN" \
  --project-ref ipmldkprqdhybedhpgmt
```

Variáveis reconhecidas pelo backend (`supabase/functions/_shared/dubbing.ts`):

| Variável | Para que serve |
|---|---|
| `EDRESSON_TTS_URL` | Endereço do servidor. **Sem ela o provedor é pulado na hora** (custo zero). |
| `EDRESSON_TTS_TOKEN` | Vira `Authorization: Bearer …`. Opcional. |
| `EDRESSON_TTS_TIMEOUT_MS` | Prazo da chamada (padrão `12000`). |
| `EDRESSON_TTS_FN` | Nome da função, quando a URL for um Space do Gradio (padrão `predict`). |
| `CLONE_DEADLINE_MS` | Corte da clonagem (padrão `3000`). |
| `XTTS_HF_MODEL` | Modelo de clonagem na Hugging Face (padrão `coqui/XTTS-v2`). |
| `TTS_ORDER` | Ordem da retaguarda (padrão `edresson,elevenlabs,polly,google`). |
| `ELEVENLABS_API_KEY` | Voz neural premium. Precisa da permissão `text_to_speech`. |
| `ELEVENLABS_MODEL` | Padrão `eleven_multilingual_v2`. |
| `STREAMELEMENTS_JWT` | Chave da StreamElements. Sem ela o provedor é pulado. |

### Formatos de servidor aceitos

O backend detecta o formato pela própria URL:

1. **API JSON** (este servidor) — `POST <url>` com `{ text, language, speaker_wav? }`.
2. **Coqui `tts-server` oficial** — a URL termina em `/api/tts`.
3. **Space do Hugging Face** — a URL contém `.hf.space`; usa o protocolo do Gradio.

---

## Conferir se está tudo de pé

```bash
curl -s -X POST \
  "https://ipmldkprqdhybedhpgmt.supabase.co/functions/v1/dubbing-health" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" -d '{}' | jq
```

A resposta diz, provedor por provedor, quem respondeu, em quantos milissegundos
e o que falta configurar.
