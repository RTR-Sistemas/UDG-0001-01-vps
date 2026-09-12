import { supabase } from "@/integrations/supabase/client";

/**
 * High-performance Translation & Cache Service.
 * Combines in-memory Map cache + Supabase translation_cache table.
 * Uses Google Translate API client-side as fast primary translation engine.
 */
class TranslationCacheService {
  private memoryCache = new Map<string, string>();

  /** Simple hash for text + language pair */
  private generateHash(text: string, targetLang: string): string {
    const cleanText = text.trim().toLowerCase();
    return `${targetLang}:${cleanText}`;
  }

  /**
   * Translates a string with automatic caching.
   */
  public async translate(text: string, targetLang: string): Promise<{
    translatedText: string;
    fromCache: boolean;
    detectedLang?: string;
  }> {
    if (!text || !text.trim()) {
      return { translatedText: text, fromCache: false };
    }

    const key = this.generateHash(text, targetLang);

    // 1. Check in-memory cache
    if (this.memoryCache.has(key)) {
      return {
        translatedText: this.memoryCache.get(key)!,
        fromCache: true,
      };
    }

    // 2. Check Supabase DB cache
    try {
      const { data } = await supabase
        .from("translation_cache" as any)
        .select("translated_text")
        .eq("source_text_hash", key)
        .eq("target_lang", targetLang)
        .maybeSingle();

      if (data && (data as any).translated_text) {
        const cached = (data as any).translated_text;
        this.memoryCache.set(key, cached);
        return { translatedText: cached, fromCache: true };
      }
    } catch {
      // Ignore DB cache errors and proceed to translation
    }

    // 3. Perform Google Translate API call
    try {
      const url =
        `https://translate.googleapis.com/translate_a/single` +
        `?client=gtx` +
        `&sl=auto` +
        `&tl=${encodeURIComponent(targetLang)}` +
        `&dt=t&dt=ld` +
        `&q=${encodeURIComponent(text)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translatedText = (data[0] as any[])
            .map((p: any) => (Array.isArray(p) ? p[0] : ""))
            .filter(Boolean)
            .join("");

          const detectedLang = data[2] || "auto";

          if (translatedText) {
            // Save to memory cache
            this.memoryCache.set(key, translatedText);

            // Save asynchronously to Supabase DB cache
            void (async () => {
              try {
                await supabase.from("translation_cache" as any).insert({
                  source_lang: detectedLang,
                  target_lang: targetLang,
                  source_text_hash: key,
                  source_text: text,
                  translated_text: translatedText,
                });
              } catch {
                // Ignore DB insertion errors
              }
            })();

            return {
              translatedText,
              fromCache: false,
              detectedLang,
            };
          }
        }
      }
    } catch (err) {
      console.warn("Client translation error:", err);
    }

    // Return original text on failure
    return { translatedText: text, fromCache: false };
  }

  /** Clear memory cache */
  public clearMemoryCache() {
    this.memoryCache.clear();
  }
}

export const translationCacheService = new TranslationCacheService();
