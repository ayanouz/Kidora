// ══════════════════════════════════════════════════════════════════
//  KIDORA — Validation des entrées avec Zod
//  Toute route valide body / query / params avant d'appeler le service.
//  Les erreurs remontent en 400 propre — jamais d'exception brute.
// ══════════════════════════════════════════════════════════════════

import type { z } from "zod";
import { ValidationError } from "../lib/errors";

function formatIssues(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(corps)",
    message: issue.message,
  }));
}

// Le générique `S extends z.ZodTypeAny` préserve le type de SORTIE du
// schéma (`z.output<S>`) : les `.default()` deviennent des champs requis
// et les `.transform()` sont reflétés — contrairement à `ZodSchema<T>`
// qui exigeait entrée = sortie (incompatible avec les deux précédents).

export function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw new ValidationError(formatIssues(result.error));
  return result.data;
}

export function parseQuery<S extends z.ZodTypeAny>(schema: S, query: unknown): z.output<S> {
  const result = schema.safeParse(query ?? {});
  if (!result.success) throw new ValidationError(formatIssues(result.error));
  return result.data;
}

export function parseParams<S extends z.ZodTypeAny>(schema: S, params: unknown): z.output<S> {
  const result = schema.safeParse(params ?? {});
  if (!result.success) throw new ValidationError(formatIssues(result.error));
  return result.data;
}
