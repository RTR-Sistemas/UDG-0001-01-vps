const fs = require('fs');

let c = fs.readFileSync('src/pages/Messages.tsx', 'utf8');

// 1. Corrigir toggleAutoTranslate e adicionar handleAutoTranslateLangChange
const oldToggle = `  const autoTranslateSkipRef = useRef<Set<string>>(new Set());

  const toggleAutoTranslate = () => {
    setAutoTranslateEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('chat_auto_translate', next ? '1' : '0'); } catch {}
  };`;

const newToggle = `  const autoTranslateSkipRef = useRef<Set<string>>(new Set());

  const toggleAutoTranslate = () => {
    setAutoTranslateEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('chat_auto_translate', next ? '1' : '0'); } catch {}
      if (next) {
        autoTranslateSkipRef.current.clear();
      }
      return next;
    });
  };

  const handleAutoTranslateLangChange = (newLang: string) => {
    setAutoTranslateLang(newLang);
    try { localStorage.setItem('chat_auto_translate_lang', newLang); } catch {}
    autoTranslateSkipRef.current.clear();
  };`;

c = c.replace(oldToggle, newToggle);

// 2. No handleTranslate, silenciar toasts de erro quando for tradução automática (isManual === false)
const oldHandleTranslate = `    } catch (error) {
      console.error('Erro na tradução do chat:', error);
      toast({ title: 'Erro na tradução', description: 'Não foi possível traduzir esta mensagem.', variant: 'destructive' });
      setTranslations(prev => prev.map(t => t.messageId === messageId ? { ...t, isLoading: false, isTranslated: false, hasFailed: true } : t));
    }`;

const newHandleTranslate = `    } catch (error) {
      console.error('Erro na tradução do chat:', error);
      if (isManual) {
        toast({ title: 'Erro na tradução', description: 'Não foi possível traduzir esta mensagem.', variant: 'destructive' });
      }
      setTranslations(prev => prev.map(t => t.messageId === messageId ? { ...t, isLoading: false, isTranslated: false, hasFailed: true } : t));
    }`;

c = c.replace(oldHandleTranslate, newHandleTranslate);

// 3. Atualizar o useEffect da Tradução Automática para traduzir imediatamente sem depender de detectLanguage
const autoTranslateRegex = /\/\/ Auto-translate effect: automatically translate messages[\s\S]*?\}, \[messages, autoTranslateEnabled, autoTranslateLang, user\?\.id, translations, handleTranslate, resolvePqText\]\);/;

const newAutoTranslateEffect = `// Auto-translate effect: automaticamente traduz todas as mensagens recebidas quando a tradução estiver ligada
  useEffect(() => {
    if (!autoTranslateEnabled || !messages || messages.length === 0) return;

    messages.forEach((msg: any) => {
      const isOwn = msg.user_id === user?.id;
      if (isOwn) return;

      const msgType = getMessageType(msg);
      if (msgType !== 'text') return;

      const existing = translations.find(t => t.messageId === msg.id);
      const skipKey = \`\${msg.id}|\${autoTranslateLang}\`;
      if (autoTranslateSkipRef.current.has(skipKey)) return;
      if (existing?.isTranslated && existing.targetLang === autoTranslateLang) return;

      const plain = resolvePqText(msg);
      if (!plain || plain.trim() === '' || plain.startsWith('__')) return;

      autoTranslateSkipRef.current.add(skipKey);

      const existingNow = translations.find(t => t.messageId === msg.id);
      if (!existingNow || existingNow.targetLang !== autoTranslateLang || (!existingNow.isTranslated && !existingNow.hasFailed)) {
        if (!existingNow?.isLoading) {
          void handleTranslate(msg.id, plain, autoTranslateLang, false);
        }
      }
    });
  }, [messages, autoTranslateEnabled, autoTranslateLang, user?.id, translations, handleTranslate, resolvePqText]);`;

c = c.replace(autoTranslateRegex, newAutoTranslateEffect);

// 4. Substituir onChange={setAutoTranslateLang} por onChange={handleAutoTranslateLangChange}
c = c.replace(/onChange=\{setAutoTranslateLang\}/g, "onChange={handleAutoTranslateLangChange}");

fs.writeFileSync('src/pages/Messages.tsx', c, 'utf8');
console.log('Auto-translate and auto-dubbing enhancements applied cleanly!');
