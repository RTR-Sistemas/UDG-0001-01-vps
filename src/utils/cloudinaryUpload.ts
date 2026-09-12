/**
 * =============================================================================
 * File: src/utils/cloudinaryUpload.ts
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

// src/utils/cloudinaryUpload.ts

import { CLOUDINARY_FOLDER } from "@/config/cloudinary";
import { supabase } from "@/integrations/supabase/client";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


export type CloudinaryUploadResult = {
  secureUrl: string;
  publicId?: string;
  resourceType?: string;
  bytes?: number;
  format?: string;
};

export const inferMediaPrefix = (file: File | Blob) => {
  const type = (file as any)?.type || "";
  if (type.startsWith("video/")) return "video::";
  if (type.startsWith("audio/")) return "audio::";
  if (type.startsWith("image/")) return "image::";
  return "";
};

const getAuthHeader = async () => {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const uploadFileToCloudinary = async (
  file: File | Blob,
  opts?: { folder?: string }
): Promise<CloudinaryUploadResult> => {
  const folder = opts?.folder || CLOUDINARY_FOLDER;

  // 1) pede assinatura ao backend (Netlify Function)
  const authHeaders = await getAuthHeader();
  const signRes = await fetch("/api/cloudinary-sign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({ folder }),
  });

  const signJson = await signRes.json().catch(() => ({}));
  if (!signRes.ok) {
    throw new Error(signJson?.error || "Falha ao assinar upload no Cloudinary");
  }

  const { cloudName, apiKey, timestamp, signature, uploadPreset, signedFolder } = signJson;
  if (!cloudName || !apiKey || !timestamp || !signature) {
    throw new Error("Resposta inválida do endpoint de assinatura");
  }

  // 2) converte para base64 para evitar problemas do CapacitorHttp com FormData nativo no Android
  const base64File = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const form = new FormData();
  form.append("file", base64File);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  if (uploadPreset) form.append("upload_preset", uploadPreset);
  if (signedFolder) form.append("folder", signedFolder);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
  const upRes = await fetch(uploadUrl, { method: "POST", body: form });
  const upJson = await upRes.json().catch(() => ({}));
  if (!upRes.ok) {
    throw new Error(upJson?.error?.message || "Falha no upload para o Cloudinary");
  }

  return {
    secureUrl: upJson.secure_url,
    publicId: upJson.public_id,
    resourceType: upJson.resource_type,
    bytes: upJson.bytes,
    format: upJson.format,
  };
};

export const uploadManyToCloudinary = async (
  files: Array<File | Blob>,
  opts?: { folder?: string }
): Promise<CloudinaryUploadResult[]> => {
  const results: CloudinaryUploadResult[] = [];
  for (const f of files) {
    results.push(await uploadFileToCloudinary(f, opts));
  }
  return results;
};
