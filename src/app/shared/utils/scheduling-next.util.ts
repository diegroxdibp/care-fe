/**
 * "next" is the URL a logged-out visitor was heading to when AccessGuard
 * intercepted them — carried through /scheduling/conta, signup/login, and
 * (same-browser) the Google OAuth round trip, so they land back where they
 * were instead of on /dashboard.
 *
 * It must only ever be a relative path inside /scheduling: accepting an
 * absolute or protocol-relative URL here would turn a CARE-controlled
 * redirect into an open redirect.
 */
const SCHEDULING_NEXT_PATTERN = /^\/scheduling(\/|\?|$)/;

export function isValidSchedulingNext(value: string | null | undefined): value is string {
  if (!value) return false;
  return SCHEDULING_NEXT_PATTERN.test(value);
}

/**
 * Persisted across tabs/full-page navigations (Google OAuth, the email
 * confirmation link opened in a new tab) — sessionStorage doesn't survive
 * either of those, localStorage does.
 */
export const SCHEDULING_NEXT_STORAGE_KEY = 'care.scheduling.next';

export function storeSchedulingNext(next: string): void {
  try {
    localStorage.setItem(SCHEDULING_NEXT_STORAGE_KEY, next);
  } catch {
    // Private browsing / storage disabled: the flow still works end-to-end
    // within a single tab, it just loses cross-tab/cross-navigation resume.
  }
}

export function readStoredSchedulingNext(): string | null {
  try {
    const value = localStorage.getItem(SCHEDULING_NEXT_STORAGE_KEY);
    return isValidSchedulingNext(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearStoredSchedulingNext(): void {
  try {
    localStorage.removeItem(SCHEDULING_NEXT_STORAGE_KEY);
  } catch {
    // no-op
  }
}
