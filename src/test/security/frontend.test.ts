import { describe, test, expect, vi } from 'vitest';

// Simulação simplificada do comportamento de controle de gestos no AppLayout
interface TouchTarget {
    classList: string[];
    closest(selector: string): boolean;
}

function shouldAllowSwipe(target: TouchTarget, inChatRoom: boolean): boolean {
    if (inChatRoom) {
        return false; // Bloqueia swipe se estiver em uma conversa ativa
    }
    
    // Bloqueia swipe dentro de mapas, inputs, sliders ou áreas marked com 'no-swipe'
    if (
        target.closest('.leaflet-container') ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('select') ||
        target.closest('[role="slider"]') ||
        target.closest('.no-swipe')
    ) {
        return false;
    }
    return true;
}

describe('📱 Suíte de Testes de Frontend - UndoinG AppLayout Gestures', () => {
    test('Bloquear Swipe horizontal quando o usuário estiver em uma sala de chat ativa', () => {
        const target: TouchTarget = {
            classList: ['chat-window'],
            closest: () => false
        };

        const result = shouldAllowSwipe(target, true); // inChatRoom = true
        expect(result).toBe(false);
    });

    test('Bloquear Swipe horizontal ao interagir com o Mapa (Leaflet Container)', () => {
        const target: TouchTarget = {
            classList: ['leaflet-zoom-animated'],
            closest: (selector) => selector === '.leaflet-container'
        };

        const result = shouldAllowSwipe(target, false); // inChatRoom = false
        expect(result).toBe(false);
    });

    test('Bloquear Swipe horizontal em Sliders de Mídia ([role="slider"])', () => {
        const target: TouchTarget = {
            classList: ['slider-thumb'],
            closest: (selector) => selector === '[role="slider"]'
        };

        const result = shouldAllowSwipe(target, false);
        expect(result).toBe(false);
    });

    test('Permitir Swipe horizontal em áreas normais do feed ou do aplicativo', () => {
        const target: TouchTarget = {
            classList: ['feed-container'],
            closest: () => false
        };

        const result = shouldAllowSwipe(target, false);
        expect(result).toBe(true);
    });

    test('Bloquear Swipe horizontal em elementos marcados explicitamente com a classe "no-swipe"', () => {
        const target: TouchTarget = {
            classList: ['custom-gesture-zone'],
            closest: (selector) => selector === '.no-swipe'
        };

        const result = shouldAllowSwipe(target, false);
        expect(result).toBe(false);
    });
});
