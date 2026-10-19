/**
 * "next" is the URL a logged-out (or not yet onboarded) visitor was heading
 * to when AccessGuard intercepted them — a scheduling step, or a link from an
 * email (a proposal, a session, a call). It is carried through
 * /scheduling/conta, signup/login, the email confirmation, onboarding and
 * (same-browser) the Google OAuth round trip, so they land back where they
 * were instead of on /dashboard.
 *
 * It must only ever be a relative path inside the app's own areas: accepting
 * an absolute or protocol-relative URL here would turn a CARE-controlled
 * redirect into an open redirect. Mirrors the backend's
 * EmailConfirmationService.VALID_NEXT_PATTERN.
 */
const RETURN_PATH_PATTERN = /^\/(scheduling|dashboard|appointments|rooms|availability|invitations)(\/|\?|$)/;

/** Só os passos do Agendar têm o tratamento "a conta é o passo 1" no AccessGuard. */
export function isSchedulingPath(value: string | null | undefined): value is string {
  return !!value && /^\/scheduling(\/|\?|$)/.test(value);
}

export function isValidReturnPath(value: string | null | undefined): value is string {
  if (!value) return false;
  return RETURN_PATH_PATTERN.test(value);
}

/**
 * Persisted across tabs/full-page navigations (Google OAuth, the email
 * confirmation link opened in a new tab) — sessionStorage doesn't survive
 * either of those, localStorage does.
 */
export const RETURN_PATH_STORAGE_KEY = 'care.scheduling.next';

export function storeReturnPath(next: string): void {
  try {
    localStorage.setItem(RETURN_PATH_STORAGE_KEY, next);
  } catch {
    // Private browsing / storage disabled: the flow still works end-to-end
    // within a single tab, it just loses cross-tab/cross-navigation resume.
  }
}

export function readStoredReturnPath(): string | null {
  try {
    const value = localStorage.getItem(RETURN_PATH_STORAGE_KEY);
    return isValidReturnPath(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearStoredReturnPath(): void {
  try {
    localStorage.removeItem(RETURN_PATH_STORAGE_KEY);
  } catch {
    // no-op
  }
}
