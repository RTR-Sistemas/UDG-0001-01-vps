import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (className utility)', () => {
    it('combina classes simples', () => {
        expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('lida com valores condicionais', () => {
        expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
    });

    it('faz merge de classes Tailwind conflitantes', () => {
        // twMerge deve resolver conflitos: p-4 vence p-2
        expect(cn('p-2', 'p-4')).toBe('p-4');
    });

    it('lida com undefined e null', () => {
        expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
    });

    it('retorna string vazia sem argumentos', () => {
        expect(cn()).toBe('');
    });
});
