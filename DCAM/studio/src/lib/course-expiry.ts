const DAY_IN_MS = 24 * 60 * 60 * 1000;

type FirestoreLikeTimestamp = {
  seconds?: number;
  toDate?: () => Date;
};

const isValidDate = (value: Date) => !Number.isNaN(value.getTime());

const getEndOfDay = (value: Date) => {
  const end = new Date(value);
  end.setHours(23, 59, 59, 999);
  return end;
};

export const parseCourseDate = (raw: unknown): Date | null => {
  if (!raw) return null;

  if (raw instanceof Date) {
    return isValidDate(raw) ? raw : null;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const exactDateMatch = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
    if (exactDateMatch) {
      const localDate = new Date(`${trimmed}T00:00:00`);
      return isValidDate(localDate) ? localDate : null;
    }

    const parsed = new Date(trimmed);
    return isValidDate(parsed) ? parsed : null;
  }

  if (typeof raw === 'number') {
    const parsed = new Date(raw);
    return isValidDate(parsed) ? parsed : null;
  }

  if (typeof raw === 'object') {
    const maybeTimestamp = raw as FirestoreLikeTimestamp;

    if (typeof maybeTimestamp.toDate === 'function') {
      const date = maybeTimestamp.toDate();
      return isValidDate(date) ? date : null;
    }

    if (typeof maybeTimestamp.seconds === 'number') {
      const date = new Date(maybeTimestamp.seconds * 1000);
      return isValidDate(date) ? date : null;
    }
  }

  return null;
};

export const toDateInputValue = (raw: unknown): string => {
  const parsed = parseCourseDate(raw);
  if (!parsed) return '';

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const formatCourseDate = (raw: unknown): string => {
  const parsed = parseCourseDate(raw);
  if (!parsed) return 'Not set';
  return parsed.toLocaleDateString();
};

export const getCourseExpiryStatus = (
  raw: unknown,
  options?: { now?: Date; warningDays?: number }
) => {
  const expiryDate = parseCourseDate(raw);
  const now = options?.now || new Date();
  const warningDays = options?.warningDays ?? 30;

  if (!expiryDate) {
    return {
      hasExpiry: false,
      expiryDate: null as Date | null,
      endOfExpiry: null as Date | null,
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: null as number | null,
    };
  }

  const endOfExpiry = getEndOfDay(expiryDate);
  const diffMs = endOfExpiry.getTime() - now.getTime();
  const isExpired = diffMs < 0;
  const isExpiringSoon = !isExpired && diffMs <= warningDays * DAY_IN_MS;
  const daysRemaining = isExpired ? 0 : Math.ceil(diffMs / DAY_IN_MS);

  return {
    hasExpiry: true,
    expiryDate,
    endOfExpiry,
    isExpired,
    isExpiringSoon,
    daysRemaining,
  };
};
