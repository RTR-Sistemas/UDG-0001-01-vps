/**
 * =============================================================================
 * File: src/services/AdvancedLanguageService.ts
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

export class AdvancedLanguageService {
  private languagePatterns = {
    'pt': { 
      commonWords: ['o', 'a', 'e', 'de', 'para', 'você', 'eu', 'que', 'não', 'com', 'no', 'na', 'um', 'uma', 'do', 'da']
    },
    'en': { 
      commonWords: ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'an', 'you', 'that', 'it', 'for', 'are', 'on', 'with', 'as', 'be', 'this', 'have', 'from']
    },
    'es': { 
      commonWords: ['el', 'la', 'los', 'las', 'y', 'en', 'de', 'que', 'un', 'una', 'es', 'por', 'con', 'para', 'se', 'no', 'del', 'al', 'su']
    },
    'fr': { 
      commonWords: ['le', 'la', 'les', 'et', 'en', 'de', 'que', 'un', 'une', 'est', 'pour', 'dans', 'qui', 'sur', 'au', 'par', 'avec', 'son', 'il']
    }
  };

  detectLanguage(text: string): string {
    const cleanText = text.toLowerCase().trim();
    if (cleanText.length < 5) return 'unknown';

    const scores: { [key: string]: number } = {};
    let maxScore = 0;
    let detectedLang = 'unknown';
    
    for (const [lang, data] of Object.entries(this.languagePatterns)) {
      let score = 0;
      data.commonWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(cleanText)) {
          score += 1;
        }
      });
      
      scores[lang] = score;
      
      if (score > maxScore) {
        maxScore = score;
        detectedLang = lang;
      }
    }

    return maxScore >= 3 ? detectedLang : 'unknown';
  }

  async translateText(text: string, sourceLang: string, targetLang: string = 'pt'): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 800)); 
    
    const translations: { [key: string]: string } = {
      'en': 'Olá, esta é uma mensagem para você e para mim.',
      'es': 'Hola amigo, ¿qué tal?',
      'fr': 'J\'espère que ce projet vous aidera.',
      'pt': text 
    };
    
    const langName = this.getLanguageName(sourceLang);
    return `[TRADUÇÃO de ${langName}] ${translations[sourceLang] || 'O texto original não pôde ser traduzido.'}`;
  }

  getLanguageName(code: string): string {
    const names: { [key: string]: string } = {
      'pt': 'Português', 'en': 'Inglês', 'es': 'Espanhol', 'fr': 'Francês', 
      'de': 'Alemão', 'it': 'Italiano'
    };
    return names[code] || code.toUpperCase();
  }
}