"use client";

const PENDING_EMAIL_VERIFICATION_KEY = "josealo_pending_email_verification_user";

export function markEmailVerificationPending(userId: string) {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.setItem(PENDING_EMAIL_VERIFICATION_KEY, userId);
}

export function clearEmailVerificationPending(userId?: string) {
  if (typeof window === "undefined") return;
  const pendingUserId = window.localStorage.getItem(PENDING_EMAIL_VERIFICATION_KEY);
  if (!userId || pendingUserId === userId) {
    window.localStorage.removeItem(PENDING_EMAIL_VERIFICATION_KEY);
  }
}

export function isEmailVerificationPending(userId: string) {
  if (typeof window === "undefined" || !userId) return false;
  return window.localStorage.getItem(PENDING_EMAIL_VERIFICATION_KEY) === userId;
}
