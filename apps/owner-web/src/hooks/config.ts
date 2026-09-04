// ─── STORE_ID: set by auth on login, persisted in localStorage ───────────────
// Falls back to VITE_STORE_ID env for development convenience.
export const getStoreId = (): string =>
  localStorage.getItem('OWNER_STORE_ID') ||
  import.meta.env.VITE_STORE_ID ||
  "";

// ─── AUTH TOKEN: set by auth on login ────────────────────────────────────────
export const getAuthToken = (): string =>
  localStorage.getItem('OWNER_TOKEN') || "";
