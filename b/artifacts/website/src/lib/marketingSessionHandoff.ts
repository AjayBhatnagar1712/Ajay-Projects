export interface MarketingSessionTokens {
  access_token: string;
  refresh_token?: string;
}

const SESSION_HASH_PREFIX = "tk_session=";

export function encodeMarketingSessionHash(tokens: MarketingSessionTokens): string {
  const payload = JSON.stringify(tokens);
  return `${SESSION_HASH_PREFIX}${encodeURIComponent(btoa(payload))}`;
}

export function decodeMarketingSessionHash(hash: string): MarketingSessionTokens | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.startsWith(SESSION_HASH_PREFIX)) return null;
  try {
    const encoded = raw.slice(SESSION_HASH_PREFIX.length);
    const parsed = JSON.parse(atob(decodeURIComponent(encoded))) as MarketingSessionTokens;
    if (typeof parsed.access_token !== "string" || !parsed.access_token) return null;
    return parsed;
  } catch {
    return null;
  }
}
