import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIsMobile } from '@/hooks/use-mobile';

// Mock do matchMedia (não existe no jsdom)
beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
});

describe('useIsMobile', () => {
    it('retorna boolean', () => {
        const { result } = renderHook(() => useIsMobile());
        expect(typeof result.current).toBe('boolean');
    });

    it('retorna false em tela grande (jsdom default = 1024)', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
        const { result } = renderHook(() => useIsMobile());
        expect(result.current).toBe(false);
    });

    it('retorna true em tela mobile (< 768)', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 });
        const { result } = renderHook(() => useIsMobile());
        expect(result.current).toBe(true);
    });
});
