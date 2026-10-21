// ══════════════════════════════════════════════════════════════════
//  KIDORA — Erreurs applicatives normalisées
//  Le client reçoit toujours : { error: { code, message, details? } }
//  Jamais de stack trace, jamais de détail interne en production.
// ══════════════════════════════════════════════════════════════════

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "EMAIL_TAKEN"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "ACCOUNT_LOCKED"
  | "ACCOUNT_DISABLED"
  | "SESSION_INVALID"
  | "SCORE_REJECTED"
  | "PREMIUM_REQUIRED"
  | "BILLING_UNAVAILABLE"
  | "ORIGIN_FORBIDDEN"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(details?: unknown) {
    super(400, "VALIDATION_ERROR", "Les données envoyées sont invalides.", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Tu dois être connecté pour faire ça.") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Tu n'as pas accès à cette action.") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Élément introuvable.") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(code: ErrorCode, message: string) {
    super(409, code, message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Trop de tentatives. Patiente un peu puis réessaie !") {
    super(429, "RATE_LIMITED", message);
  }
}

export class PremiumRequiredError extends AppError {
  constructor(message = "Ce jeu fait partie du catalogue Premium.", details?: unknown) {
    super(402, "PREMIUM_REQUIRED", message, details);
  }
}

export class BillingUnavailableError extends AppError {
  constructor(
    message = "Le paiement est momentanément indisponible. Réessaie dans un instant.",
  ) {
    super(503, "BILLING_UNAVAILABLE", message);
  }
}

export class InternalError extends AppError {
  constructor(message = "Une erreur est survenue.") {
    super(500, "INTERNAL_ERROR", message);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
