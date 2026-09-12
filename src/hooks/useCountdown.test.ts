import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountdown } from '@/hooks/useCountdown';

describe('useCountdown', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('retorna 00:00 quando não há data de expiração', () => {
        const { result } = renderHook(() => useCountdown(null));

        expect(result.current.totalSec).toBe(0);
        expect(result.current.label).toBe('00:00');
    });

    it('retorna 00:00 quando expiresAt é undefined', () => {
        const { result } = renderHook(() => useCountdown(undefined));

        expect(result.current.totalSec).toBe(0);
        expect(result.current.label).toBe('00:00');
    });

    it('calcula countdown corretamente para data futura', () => {
        const futureDate = new Date(Date.now() + 65000).toISOString(); // 65 segundos
        const { result } = renderHook(() => useCountdown(futureDate));

        // Deveria mostrar ~01:05 (pode variar por milissegundos)
        expect(result.current.totalSec).toBeGreaterThanOrEqual(64);
        expect(result.current.totalSec).toBeLessThanOrEqual(65);
        expect(result.current.label).toMatch(/^01:0[45]$/);
    });

    it('retorna 00:00 para data no passado', () => {
        const pastDate = new Date(Date.now() - 10000).toISOString();
        const { result } = renderHook(() => useCountdown(pastDate));

        expect(result.current.totalSec).toBe(0);
        expect(result.current.label).toBe('00:00');
    });

    it('decrementa o timer ao longo do tempo', () => {
        const futureDate = new Date(Date.now() + 10000).toISOString(); // 10 segundos
        const { result } = renderHook(() => useCountdown(futureDate));

        const initialSec = result.current.totalSec;

        act(() => {
            vi.advanceTimersByTime(2000); // Avança 2 segundos
        });

        expect(result.current.totalSec).toBeLessThan(initialSec);
    });
});
