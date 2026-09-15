// Helpers for 'YYYY-MM-DD' calendar days sent by the client.

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// Parses 'YYYY-MM-DD' into { year, month, day }, or null if it is not a real date.
export const parseCalendarDay = (value) => {
  const match = typeof value === 'string' ? DAY_PATTERN.exec(value) : null;
  if (!match) return null;

  const [year, month, day] = match.slice(1).map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
};

// Storage instant for a calendar day: 12:00 UTC keeps it on the same day
// wherever the client is.
export const calendarDayToDate = ({ year, month, day }) =>
  new Date(Date.UTC(year, month - 1, day, 12));

export const startOfUTCDay = ({ year, month, day }) =>
  new Date(Date.UTC(year, month - 1, day));

export const endOfUTCDay = ({ year, month, day }) =>
  new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
