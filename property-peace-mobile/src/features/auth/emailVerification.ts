export const CODE_EXPIRY_SECONDS = 10 * 60;
export const RESEND_COOLDOWN_SECONDS = 30;

export function normalizeVerificationCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function secondsRemaining(sentAt: number, now: number): number {
  return Math.max(
    0,
    Math.ceil((sentAt + CODE_EXPIRY_SECONDS * 1_000 - now) / 1_000),
  );
}
