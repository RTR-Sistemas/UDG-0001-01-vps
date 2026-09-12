import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Limpa o DOM após cada teste
afterEach(() => {
    cleanup();
});

// Mock do import.meta.env para testes
Object.defineProperty(import.meta, 'env', {
    value: {
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'test-anon-key',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
        VITE_HUGGINGFACE_TOKEN: 'test-hf-token',
        VITE_VAPID_PUBLIC_KEY: 'test-vapid-key',
        MODE: 'test',
        DEV: false,
        PROD: false,
    },
    writable: true,
});
