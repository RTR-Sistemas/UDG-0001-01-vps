const fs = require('fs');

let c = fs.readFileSync('src/pages/Messages.tsx', 'utf8');

const languagesFix = `const AVAILABLE_LANGUAGES = [
  { code: 'pt', name: 'Português (BR)', flag: '🇧🇷', nativeName: 'Português', speechLang: 'pt-BR' },
  { code: 'en', name: 'Inglês', flag: '🇺🇸', nativeName: 'English', speechLang: 'en-US' },
  { code: 'es', name: 'Espanhol', flag: '🇪🇸', nativeName: 'Español', speechLang: 'es-ES' },
  { code: 'fr', name: 'Francês', flag: '🇫🇷', nativeName: 'Français', speechLang: 'fr-FR' },
  { code: 'de', name: 'Alemão', flag: '🇩🇪', nativeName: 'Deutsch', speechLang: 'de-DE' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', nativeName: 'Italiano', speechLang: 'it-IT' },
  { code: 'ja', name: 'Japonês', flag: '🇯🇵', nativeName: '日本語', speechLang: 'ja-JP' },
  { code: 'ko', name: 'Coreano', flag: '🇰🇷', nativeName: '한국어', speechLang: 'ko-KR' },
  { code: 'zh', name: 'Chinês', flag: '🇨🇳', nativeName: '中文', speechLang: 'zh-CN' },
  { code: 'ru', name: 'Russo', flag: '🇷🇺', nativeName: 'Русский', speechLang: 'ru-RU' },
  { code: 'ar', name: 'Árabe', flag: '🇸🇦', nativeName: 'العربية', speechLang: 'ar-SA' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', nativeName: 'हिन्दी', speechLang: 'hi-IN' },
];`;

c = c.replace(/const AVAILABLE_LANGUAGES = \[[\s\S]*?\];/, languagesFix);

c = c.replace(/return lang \? lang\.flag : '[^']+';/, "return lang ? lang.flag : '🌐';");
c = c.replace(/\{current\?\.flag \|\| '[^']+'\}/, "{current?.flag || '🌐'}");
c = c.replace(/ðŸ§© Figurinha/g, "🧩 Figurinha");
c = c.replace(/ðŸ“Š Enquete/g, "📊 Enquete");
c = c.replace(/ðŸ”  Mensagem criptografada/g, "🔐 Mensagem criptografada");
c = c.replace(/ðŸ“· Mídia enviada/g, "📷 Mídia enviada");
c = c.replace(/â€¢/g, "•");
c = c.replace(/â€”/g, "—");

fs.writeFileSync('src/pages/Messages.tsx', c, 'utf8');
console.log('Restored languages and emojis cleanly!');
