// ══════════════════════════════════════════════════════════════════
//  KIDORA — Client API
//  • Cookies HttpOnly (credentials: "include") → pas de token en JS
//  • Réponse d'erreur normalisée → ApiError { code, message }
//  • 401 → tentative de refresh UNE fois, puis rejeu automatique
//  • Les messages d'erreur serveur sont déjà "enfant-friendly"
// ══════════════════════════════════════════════════════════════════

import { API_BASE } from "../config";
import type { ApiErrorBody } from "../types";

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type SessionExpiredListener = () => void;
let sessionExpiredListener: SessionExpiredListener | null = null;

/** Permet au store d'auth de réagir à l'expiration de session. */
export function onSessionExpired(listener: SessionExpiredListener): void {
  sessionExpiredListener = listener;
}

const NETWORK_ERROR_MESSAGE =
  "Oups ! Impossible de joindre le serveur. Vérifie ta connexion puis réessaie.";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Désactive la tentative de refresh sur 401 (routes auth). */
  skipRefresh?: boolean;
  signal?: AbortSignal;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body?.error?.code) {
      return new ApiError(response.status, body.error.code, body.error.message, body.error.details);
    }
  } catch {
    // corps non-JSON → erreur générique
  }
  return new ApiError(response.status, "INTERNAL_ERROR", "Une erreur est survenue.");
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, skipRefresh = false, signal } = options;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK_ERROR", NETWORK_ERROR_MESSAGE);
  }

  // Session expirée → refresh silencieux puis rejeu (une seule fois)
  if (response.status === 401 && !skipRefresh) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return api<T>(path, { ...options, skipRefresh: true });
    }
    sessionExpiredListener?.();
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  // 204 / corps vide
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** Téléchargement de fichier (export RGPD). */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw await parseError(response);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Construit une query string en ignorant les valeurs vides. */
export function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
