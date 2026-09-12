import { describe, it, expect, vi } from "vitest";
import { translationCacheService } from "../services/TranslationCacheService";

describe("TranslationCacheService", () => {
  it("should return the same text for empty inputs", async () => {
    const result = await translationCacheService.translate("", "pt");
    expect(result.translatedText).toBe("");
    expect(result.fromCache).toBe(false);
  });

  it("should utilize memory cache for identical text queries", async () => {
    // Mock global fetch to simulate Google Translate API
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [[["Olá mundo", "Hello world", null, null, 1]], null, "en"],
    } as any);

    const firstCall = await translationCacheService.translate("Hello world", "pt");
    expect(firstCall.translatedText).toBe("Olá mundo");

    // Second call should hit memory cache without fetching again
    const secondCall = await translationCacheService.translate("Hello world", "pt");
    expect(secondCall.translatedText).toBe("Olá mundo");
    expect(secondCall.fromCache).toBe(true);
  });
});
