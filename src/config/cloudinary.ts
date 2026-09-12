/**
 * =============================================================================
 * File: src/config/cloudinary.ts
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

// src/config/cloudinary.ts

/**
 * Pasta padrão no Cloudinary.
 * Pode ser sobrescrita via VITE_CLOUDINARY_FOLDER no build do front-end.
 */
export const CLOUDINARY_FOLDER = import.meta.env.VITE_CLOUDINARY_FOLDER || "Galeria_UndoinG";
