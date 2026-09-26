// Nepali (Bikram Sambat) calendar utility
//
// BS month lengths vary year to year and cannot be derived from a formula, so
// conversion uses the lookup tables shipped with nepali-date-converter
// (BS 2000–2090).
import NepaliDateModule from 'nepali-date-converter';

const NepaliDate = NepaliDateModule.default ?? NepaliDateModule;

const BS_MONTHS = [
  'Baisakh', 'Jestha', 'Ashad', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

const kathmanduDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kathmandu',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

// AD days covered by the lookup tables: BS 2000/01/01 to BS 2090/12/30.
// The library throws just outside this range but returns wrong values for
// dates far before it, so the range is checked explicitly.
const MIN_AD_DAY = 19430414;
const MAX_AD_DAY = 20340413;

// The calendar day in Nepal for an instant. The server runs in UTC, so using
// its local date would put anything recorded before 05:45 NPT on the previous day.
const getKathmanduDay = (date) => {
  const parts = kathmanduDateFormat.formatToParts(date);
  const get = (type) => Number(parts.find(p => p.type === type).value);
  return { year: get('year'), month: get('month'), day: get('day') };
};

// Convert AD date to BS. Returns null for invalid dates or dates outside the
// supported BS range.
export const adToBS = (adDate) => {
  const date = new Date(adDate);
  if (Number.isNaN(date.getTime())) return null;

  const { year, month: adMonth, day } = getKathmanduDay(date);
  const dayKey = year * 10000 + adMonth * 100 + day;
  if (dayKey < MIN_AD_DAY || dayKey > MAX_AD_DAY) return null;

  let bs;
  try {
    bs = new NepaliDate(new Date(year, adMonth - 1, day)).getBS();
  } catch {
    return null;
  }

  const month = bs.month + 1;
  const monthName = BS_MONTHS[bs.month];
  const fullDate = `${bs.year} ${monthName} ${String(bs.date).padStart(2, '0')}`;

  return { year: bs.year, month, day: bs.date, monthName, fullDate };
};
