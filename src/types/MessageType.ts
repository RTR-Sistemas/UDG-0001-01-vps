/**
 * =============================================================================
 * File: src/types/MessageType.ts
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

export type MessageType = {
  id: string;
  text: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  fileUrl?: string;
  senderId: string;
  receiverId: string;
  timestamp: Date;
  
  // === Campos de Segurança (Auto-Destrutivas) ===
  viewed: boolean; 
  expiresAt: Date | null;
  isDeleted: boolean; 
  
  // === Campos de Tradução ===
  language: string;
  translatedText?: string;
  isTranslated: boolean;
};