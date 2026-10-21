// ══════════════════════════════════════════════════════════════════
//  KIDORA — Schémas de validation du module Auth
// ══════════════════════════════════════════════════════════════════

import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
  .max(100, "Le mot de passe est trop long (100 caractères max).")
  .regex(/[A-Za-z]/, "Le mot de passe doit contenir au moins une lettre.")
  .regex(/\d/, "Le mot de passe doit contenir au moins un chiffre.");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Adresse email invalide.")
  .max(120);

const currentYear = new Date().getFullYear();

export const ageTierSchema = z.enum(["AGE_3_5", "AGE_6_8", "AGE_9_12", "AGE_13_PLUS"]);

export const registerSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Le prénom doit contenir au moins 2 caractères.")
    .max(30, "Le prénom est trop long (30 caractères max)."),
  email: emailSchema,
  password: passwordSchema,
  ageTier: ageTierSchema.optional(),
  birthYear: z
    .number()
    .int()
    .min(1930, "Année de naissance invalide.")
    .max(currentYear, "Année de naissance invalide.")
    .optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Tu dois accepter les conditions d'utilisation." }),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Mot de passe requis.").max(100),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, "Lien de réinitialisation invalide.").max(200),
  password: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
