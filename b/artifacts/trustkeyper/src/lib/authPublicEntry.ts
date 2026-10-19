/**
 * Call when entering login/signup. Clears in-tab session only so auth screens
 * do not treat the user as logged in; keeps localStorage backup so broker/owner
 * routes can restore the session after browser back/forward (logout still clears backup).
 * Preserves tk_pending_role for the login flow.
 */
export function resetSessionForAuthEntry(): void {
  sessionStorage.removeItem("tk_active_phone");
  sessionStorage.removeItem("tk_active_role");
}
