// Bikram Sambat (BS) calendar helpers.
//
// BS month lengths vary year to year, so conversions use the lookup tables in
// nepali-date-converter (BS 2000–2090). All functions work with local calendar
// days: a Date is treated as the day it falls on in the user's timezone.
import NepaliDateModule from 'nepali-date-converter';

const NepaliDate = NepaliDateModule.default ?? NepaliDateModule;

export const BS_MONTHS = [
  'Baisakh', 'Jestha', 'Ashad', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

// Three-letter forms for chart axes. Ashad/Ashwin would both abbreviate to
// "Ash", so they use Asa/Asw.
export const BS_MONTHS_SHORT = [
  'Bai', 'Jes', 'Asa', 'Shr', 'Bha', 'Asw',
  'Kar', 'Man', 'Pou', 'Mag', 'Fal', 'Cha'
];

// AD days covered by the tables (BS 2000/01/01 – 2090/12/30). The library
// returns wrong values for some dates far outside it, so check explicitly.
const MIN_AD = new Date(1943, 3, 14);
const MAX_AD = new Date(2034, 3, 13);

const DAY_MS = 24 * 60 * 60 * 1000;

export const startOfDay = (date) => {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

export const addDays = (date, days) => {
  const d = startOfDay(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
};

// Whole calendar days from a to b (DST-safe).
export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);

// 'YYYY-MM-DD' for the local calendar day (what <input type="date"> expects).
// Unlike toISOString(), this does not shift to the UTC day.
export const toISODate = (date) => {
  const d = new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export const parseISODate = (value) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const inRange = (day) => day >= MIN_AD && day <= MAX_AD;

// { year, monthIndex (0–11), day, monthName } or null when unsupported.
export const toBS = (date) => {
  const day = startOfDay(date);
  if (Number.isNaN(day.getTime()) || !inRange(day)) return null;
  try {
    const bs = new NepaliDate(day).getBS();
    return { year: bs.year, monthIndex: bs.month, day: bs.date, monthName: BS_MONTHS[bs.month] };
  } catch {
    return null;
  }
};

// AD date of a BS day, or null when unsupported.
export const fromBS = (year, monthIndex, day) => {
  try {
    return startOfDay(new NepaliDate(year, monthIndex, day).toJsDate());
  } catch {
    return null;
  }
};

export const shiftBSMonth = ({ year, monthIndex }, delta) => {
  const total = year * 12 + monthIndex + delta;
  return { year: Math.floor(total / 12), monthIndex: ((total % 12) + 12) % 12 };
};

// First and last AD day of a BS month, or null when unsupported.
export const bsMonthRange = ({ year, monthIndex }) => {
  const start = fromBS(year, monthIndex, 1);
  const next = shiftBSMonth({ year, monthIndex }, 1);
  const nextStart = fromBS(next.year, next.monthIndex, 1);
  if (!start) return null;
  // The last supported month has no following month in the tables.
  const end = nextStart ? addDays(nextStart, -1) : MAX_AD;
  return { start, end };
};

const adFormat = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
const adFormatShort = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' });

// "Bhadra 30, 2083" — falls back to the AD date outside the supported range.
export const formatBS = (date, { withYear = true } = {}) => {
  const bs = toBS(date);
  if (!bs) return (withYear ? adFormat : adFormatShort).format(new Date(date));
  return withYear ? `${bs.monthName} ${bs.day}, ${bs.year}` : `${bs.monthName} ${bs.day}`;
};

// "2083 Bhadra 30" — the order already used for stored group expense dates.
export const formatBSNumeric = (date) => {
  const bs = toBS(date);
  if (!bs) return adFormat.format(new Date(date));
  return `${bs.year} ${bs.monthName} ${String(bs.day).padStart(2, '0')}`;
};

// "Bha 5" — compact axis label.
export const formatBSShort = (date) => {
  const bs = toBS(date);
  if (!bs) return adFormatShort.format(new Date(date));
  return `${BS_MONTHS_SHORT[bs.monthIndex]} ${bs.day}`;
};

export const formatAD = (date, { withYear = true } = {}) =>
  (withYear ? adFormat : adFormatShort).format(new Date(date));
