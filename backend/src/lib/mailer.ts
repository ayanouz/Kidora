// ══════════════════════════════════════════════════════════════════
//  KIDORA — Envoi d'emails (mot de passe oublié)
//  En dev / MAIL_DRY_RUN=true : le contenu est loggué, pas envoyé.
//  En production : SMTP configuré via variables d'environnement.
// ══════════════════════════════════════════════════════════════════

import nodemailer, { type Transporter } from "nodemailer";
import { env, isProd } from "../config/env";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    });
  }
  return transporter;
}

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Envoi best-effort : une erreur d'email ne doit jamais casser une requête. */
export async function sendMail(input: MailInput, log: { info: (msg: string) => void; warn: (msg: string) => void }): Promise<void> {
  const transport = getTransporter();
  if (env.MAIL_DRY_RUN || !transport) {
    // En dev on loggue le contenu (avec lien) pour pouvoir tester le flux.
    log.info(`[MAIL:DRY_RUN] → ${input.to} | ${input.subject}\n${input.text}`);
    return;
  }
  try {
    await transport.sendMail({
      from: env.MAIL_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  } catch (err) {
    log.warn(`[MAIL] Échec d'envoi vers ${maskEmail(input.to)} : ${(err as Error).message}`);
  }
}

/** Masque un email pour les logs : a***@domaine.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

// ── Gabarits ───────────────────────────────────────────────────────

export function passwordResetMail(resetUrl: string): Omit<MailInput, "to"> {
  return {
    subject: "Kidora — Réinitialise ton mot de passe",
    text: `Bonjour,\n\nQuelqu'un a demandé la réinitialisation du mot de passe de ton compte Kidora.\n\nClique sur ce lien (valable ${env.PASSWORD_RESET_TTL_MINUTES} minutes) :\n${resetUrl}\n\nSi tu n'es pas à l'origine de cette demande, ignore cet email : ton mot de passe reste inchangé.\n\nL'équipe Kidora`,
    html: `<p>Bonjour,</p>
<p>Quelqu'un a demandé la réinitialisation du mot de passe de ton compte Kidora.</p>
<p><a href="${resetUrl}">Réinitialiser mon mot de passe</a> — valable ${env.PASSWORD_RESET_TTL_MINUTES} minutes.</p>
<p>Si tu n'es pas à l'origine de cette demande, ignore cet email : ton mot de passe reste inchangé.</p>
<p>— L'équipe ${isProd ? "Kidora" : "Kidora (dev)"}</p>`,
  };
}
