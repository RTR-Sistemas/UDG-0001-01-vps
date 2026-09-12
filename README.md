# Melhorias: Dublagem Automática com Voz do Usuário + Correção de Texto

Este pacote contém **apenas os arquivos alterados/criados**, mantendo a mesma
estrutura de pastas do projeto original (`UndoinG`). Basta copiar cada arquivo
para o mesmo caminho dentro do seu projeto, substituindo os existentes.

```
netlify/functions/voice-clone-translate.js   (ATUALIZADO)
netlify/functions/correct-text.js            (NOVO)
src/hooks/useVoiceCloneTranslate.ts          (ATUALIZADO)
src/hooks/useTextCorrection.ts               (NOVO)
src/components/MessageInput.tsx              (ATUALIZADO)
src/pages/Messages.tsx                       (ATUALIZADO)
```

---

## 1. Dublagem 100% automática com a voz do usuário

### O que mudou
- O botão **"Traduzir áudio"** no menu de Ações do chat foi renomeado para
  **"Dublagem automática"**. Quando ativado:
  - Ao terminar de gravar um áudio, o sistema **automaticamente**:
    1. Transcreve o áudio (Whisper, via Hugging Face — gratuito).
    2. **Detecta o idioma original** falado (mesmo que o Whisper não informe,
       há um fallback de detecção via Google Translate sobre o texto
       transcrito).
    3. Traduz o texto para o idioma de destino escolhido (padrão: o último
       idioma usado, salvo por usuário em `localStorage`).
    4. Gera o áudio dublado **com a voz clonada do próprio usuário** via
       **XTTS-v2** (Coqui, gratuito via Hugging Face Inference API,
       zero-shot voice cloning).
  - O resultado já aparece pronto para o usuário, sem precisar clicar em
    nada — exibindo um banner com:
    - 🇧🇷 **Idioma original detectado** (com bandeira e nome em português)
    - ➜ Idioma de destino da dublagem
  - O usuário ainda pode trocar o idioma de destino e clicar em
    "Traduzir & Dublar" novamente para gerar outra versão.
  - Cascata de fallback de voz, do melhor para o pior (todos gratuitos):
    1. **XTTS-v2** — clonagem de voz real (sua própria voz).
    2. **Google Translate TTS** — voz natural, não clonada.
    3. **Facebook MMS-TTS** — último recurso.

### Variáveis de ambiente necessárias (Netlify)
Nenhuma nova variável é necessária além da já existente:
- `HUGGINGFACE_TOKEN_DUBLAGEM` (ou `HF_API_TOKEN` / `HUGGINGFACE_TOKEN`)
  — token gratuito da Hugging Face, usado para Whisper (transcrição) e
  XTTS-v2 (clonagem de voz).

> Dica: crie uma conta gratuita em https://huggingface.co/settings/tokens
> e gere um token com permissão de leitura (`read`).

---

## 2. Correção automática de texto (ortografia/gramática)

### O que foi adicionado
- Nova função serverless `netlify/functions/correct-text.js`:
  - Detecta o idioma do texto (Google Translate, gratuito).
  - Verifica erros de ortografia/gramática usando o **LanguageTool**
    (https://api.languagetool.org — gratuito, sem chave de API).
  - Retorna o texto corrigido + lista de problemas encontrados.
  - **Nunca falha de forma "dura"**: se o serviço estiver indisponível,
    devolve o texto original normalmente (a UI continua funcionando).

- Novo hook `src/hooks/useTextCorrection.ts` para chamar essa função.

- Novo toggle **"Corrigir texto"** no menu de Ações do chat (junto aos
  outros, como "Tradução automática" e "Dublagem automática").

- No campo de digitação (`MessageInput.tsx`):
  - Enquanto o usuário digita (e o recurso está ativado), o sistema
    verifica automaticamente após uma pequena pausa (debounce de ~1.2s)
    se há erros.
  - Se encontrar erros, mostra um **banner de sugestão** acima do campo
    de mensagem, com o texto corrigido e dois botões:
    - **"Aplicar correção"** — substitui o texto pelo corrigido.
    - **"Manter original"** — descarta a sugestão.
  - Também há um botãozinho de "varinha mágica" (🪄) dentro do campo de
    texto para forçar a verificação manualmente em qualquer momento.

Nenhuma chave de API é necessária para esse recurso — tudo é gratuito.

---

## 3. Resumo das mudanças por arquivo

### `netlify/functions/voice-clone-translate.js`
- Adicionado mapa `LANGUAGE_INFO` (código → nome em PT-BR + bandeira).
- Nova função `detectLanguageFromText()` (fallback de detecção de idioma
  via Google Translate quando o Whisper não retorna o idioma).
- A resposta da API agora inclui:
  - `detectedLanguage`: código normalizado (ex.: `pt`, `en`)
  - `detectedLanguageInfo`: `{ code, name, flag }`
  - `targetLanguageInfo`: `{ code, name, flag }`

### `netlify/functions/correct-text.js` (novo)
- Endpoint `POST /.netlify/functions/correct-text`
- Body: `{ "text": "...", "lang"?: "pt" }`
- Resposta:
  ```json
  {
    "success": true,
    "originalText": "...",
    "correctedText": "...",
    "hasErrors": true,
    "issuesCount": 2,
    "issues": [{ "message": "...", "original": "...", "replacement": "..." }],
    "language": "pt",
    "languageName": "Português"
  }
  ```

### `src/hooks/useVoiceCloneTranslate.ts`
- Tipo `VoiceCloneTranslateResult` agora inclui `detectedLanguageInfo` e
  `targetLanguageInfo` (tipo `LanguageInfo = { code, name, flag }`).

### `src/hooks/useTextCorrection.ts` (novo)
- Hook `useTextCorrection()` → `{ correctText, isChecking }`.

### `src/components/MessageInput.tsx`
- Gravação de áudio agora dispara automaticamente o pipeline de
  tradução/dublagem quando `audioTranslateEnabled` está ativo.
- Painel de áudio gravado exibe status "Analisando o áudio..." e, ao
  concluir, o idioma original detectado + idioma de destino.
- Idioma de dublagem preferido é salvo por usuário (`localStorage`).
- Novo banner de sugestão de correção de texto + botão de verificação
  manual (ícone de varinha) dentro do campo de mensagem.
- Nova prop `autoCorrectEnabled?: boolean` (padrão `true`).

### `src/pages/Messages.tsx`
- Novo estado/persistência `autoCorrectEnabled` (`localStorage:
  chat_auto_correct`).
- Novo item no menu de Ações: **"Corrigir texto"** (toggle).
- Texto do item "Traduzir áudio" atualizado para **"Dublagem
  automática"**, com nova descrição explicando o comportamento
  automático.
- `autoCorrectEnabled` passado para `<MessageInput />`.

---

## 4. Como aplicar

1. Copie os 6 arquivos deste pacote para os mesmos caminhos no seu
   projeto (substituindo os existentes / criando os novos).
2. Confirme que a variável `HUGGINGFACE_TOKEN_DUBLAGEM` (ou
   `HF_API_TOKEN`/`HUGGINGFACE_TOKEN`) está configurada nas variáveis de
   ambiente da Netlify.
3. Faça commit/push e deixe a Netlify rebuildar (as funções em
   `netlify/functions` são detectadas automaticamente).
4. Teste:
   - Grave um áudio com "Dublagem automática" ativada → o áudio dublado
     com o idioma de origem identificado deve aparecer automaticamente.
   - Digite um texto com erros de português e veja a sugestão de
     correção aparecer.

> Observação: tanto o XTTS-v2 quanto o LanguageTool são serviços públicos
> gratuitos e podem ter "cold start" (demora na primeira chamada) ou
> limites de uso em horários de pico. O código já trata esses casos com
> retentativas e fallbacks, mas em uso muito intenso pode ser necessário
> avaliar planos pagos/hospedagem própria desses modelos no futuro.
