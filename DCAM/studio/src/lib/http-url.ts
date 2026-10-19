export const isValidHttpUrl = (value?: string | null) => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};
