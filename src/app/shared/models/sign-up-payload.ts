
export interface SignUpPayload {
  email: string;
  password: string;
  name?: string;
  /** Validated /scheduling path to resume after confirming — see AccessGuard. */
  next?: string | null;
}