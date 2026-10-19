export const normalizeTestDurationMinutes = (value: unknown): number | null => {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
};

export const hasTestTimeLimit = (value: unknown) => normalizeTestDurationMinutes(value) !== null;

export const formatTestDurationLabel = (
  value: unknown,
  options?: { unit?: 'short' | 'long' }
) => {
  const duration = normalizeTestDurationMinutes(value);
  if (duration === null) return 'No time limit';
  if (options?.unit === 'long') {
    return `${duration} minute${duration === 1 ? '' : 's'}`;
  }
  return `${duration} min`;
};
