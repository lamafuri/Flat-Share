// Pure helpers behind the Expenses insights page: date ranges in the Bikram
// Sambat calendar, bucketing, totals and period comparison. No React here so
// the calculations can be tested on their own.
import { getCategory } from './expenses';
import { GROUP_ITEMS, findItem, getGroupCategory } from './catalog';
import {
  BS_MONTHS_SHORT, addDays, bsMonthRange, daysBetween, formatBS, fromBS, shiftBSMonth,
  startOfDay, toBS
} from './nepaliDate';

export const RANGE_PRESETS = [
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'last3', label: '3 months' },
  { key: 'last6', label: '6 months' },
  { key: 'thisYear', label: 'This year' },
  { key: 'custom', label: 'Custom' }
];

export const SOURCE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'personal', label: 'Personal' },
  { key: 'group', label: 'Groups' }
];

export const MAX_CUSTOM_RANGE_DAYS = 366;

const monthsSpan = (month, count) => ({
  start: bsMonthRange(shiftBSMonth(month, -(count - 1))).start,
  end: bsMonthRange(month).end
});

// Human label for a range, e.g. "Bhadra 1 – 31, 2083" or "Ashad 1 – Bhadra 31, 2083".
const formatRangeLabel = ({ start, end }) => {
  const a = toBS(start);
  const b = toBS(end);
  if (!a || !b) return `${formatBS(start)} – ${formatBS(end)}`;
  if (a.year !== b.year) return `${formatBS(start)} – ${formatBS(end)}`;
  if (a.monthIndex === b.monthIndex) return `${a.monthName} ${a.day} – ${b.day}, ${b.year}`;
  return `${a.monthName} ${a.day} – ${b.monthName} ${b.day}, ${b.year}`;
};

// Resolves a preset (or custom days) into the current and previous period.
// Returns null when the dates are outside the supported BS range.
export const resolveRange = (preset, custom, today = new Date()) => {
  const bsToday = toBS(today);
  if (!bsToday) return null;
  const month = { year: bsToday.year, monthIndex: bsToday.monthIndex };

  let current;
  let previous;

  switch (preset) {
    case 'lastMonth': {
      const last = shiftBSMonth(month, -1);
      current = bsMonthRange(last);
      previous = bsMonthRange(shiftBSMonth(month, -2));
      break;
    }
    case 'last3':
      current = monthsSpan(month, 3);
      previous = monthsSpan(shiftBSMonth(month, -3), 3);
      break;
    case 'last6':
      current = monthsSpan(month, 6);
      previous = monthsSpan(shiftBSMonth(month, -6), 6);
      break;
    case 'thisYear':
      current = { start: fromBS(month.year, 0, 1), end: bsMonthRange({ year: month.year, monthIndex: 11 })?.end };
      previous = { start: fromBS(month.year - 1, 0, 1), end: bsMonthRange({ year: month.year - 1, monthIndex: 11 })?.end };
      break;
    case 'custom': {
      if (!custom?.start || !custom?.end) return null;
      const start = startOfDay(custom.start);
      const end = startOfDay(custom.end);
      const length = daysBetween(start, end) + 1;
      current = { start, end };
      const previousEnd = addDays(start, -1);
      previous = { start: addDays(previousEnd, -(length - 1)), end: previousEnd };
      break;
    }
    case 'thisMonth':
    default:
      current = bsMonthRange(month);
      previous = bsMonthRange(shiftBSMonth(month, -1));
  }

  if (!current?.start || !current?.end || !previous?.start || !previous?.end) return null;

  const todayDay = startOfDay(today);
  const inProgress = todayDay >= current.start && todayDay <= current.end;
  // Days counted for averages: up to today while the period is still running.
  const elapsedEnd = inProgress ? todayDay : current.end;
  const elapsedDays = current.start > todayDay ? 0 : daysBetween(current.start, elapsedEnd) + 1;

  return {
    ...current,
    previous,
    inProgress,
    elapsedDays,
    totalDays: daysBetween(current.start, current.end) + 1,
    label: formatRangeLabel(current)
  };
};

// Keeps entries whose local calendar day falls inside [start, end]. The API
// widens its query window, so this trimming is required.
export const entriesInRange = (entries, { start, end }) =>
  entries.filter(entry => {
    const day = startOfDay(entry.date);
    return day >= start && day <= end;
  });

export const filterBySource = (entries, source) =>
  source === 'all' ? entries : entries.filter(entry => entry.source === source);

const sum = (entries) => entries.reduce((total, entry) => total + entry.amount, 0);

export const summarize = (entries) => {
  const personal = sum(entries.filter(e => e.source === 'personal'));
  const group = sum(entries.filter(e => e.source === 'group'));
  const largest = entries.reduce((max, e) => (!max || e.amount > max.amount ? e : max), null);
  return { total: personal + group, personal, group, count: entries.length, largest };
};

export const granularityFor = ({ start, end }) => {
  const days = daysBetween(start, end) + 1;
  if (days <= 45) return 'day';
  if (days <= 130) return 'week';
  return 'month';
};

// Totals per day, week (Sunday–Saturday, clipped to the range) or BS month,
// covering the whole range so the axis stays stable; buckets after today are
// marked `future`.
export const bucketize = (entries, range, granularity, today = new Date()) => {
  const buckets = [];
  const todayDay = startOfDay(today);

  if (granularity === 'month') {
    const first = toBS(range.start);
    let month = { year: first.year, monthIndex: first.monthIndex };
    for (;;) {
      const span = bsMonthRange(month);
      if (!span || span.start > range.end) break;
      const start = span.start < range.start ? range.start : span.start;
      const end = span.end > range.end ? range.end : span.end;
      buckets.push({
        start, end,
        tick: BS_MONTHS_SHORT[month.monthIndex],
        label: `${toBS(start).monthName} ${month.year}`
      });
      month = shiftBSMonth(month, 1);
    }
  } else {
    let start = range.start;
    while (start <= range.end) {
      let end = start;
      if (granularity === 'week') {
        end = addDays(start, 6 - start.getDay());
        if (end > range.end) end = range.end;
      }
      const a = toBS(start);
      const b = toBS(end);
      buckets.push({
        start, end,
        tick: granularity === 'day' ? String(a.day) : `${BS_MONTHS_SHORT[a.monthIndex]} ${a.day}`,
        label: granularity === 'day'
          ? formatBS(start)
          : a.monthIndex === b.monthIndex ? `${a.monthName} ${a.day} – ${b.day}` : `${a.monthName} ${a.day} – ${b.monthName} ${b.day}`
      });
      start = addDays(end, 1);
    }
  }

  const rows = buckets.map(bucket => ({
    ...bucket,
    key: bucket.start.getTime(),
    personal: 0,
    group: 0,
    future: bucket.start > todayDay
  }));

  // Buckets are contiguous and sorted, so find each entry's bucket by scan.
  for (const entry of entries) {
    const day = startOfDay(entry.date);
    const row = rows.find(r => day >= r.start && day <= r.end);
    if (row) row[entry.source] += entry.amount;
  }

  return rows.map(row => ({ ...row, total: row.personal + row.group }));
};

// Category of any entry. Group items saved before categories existed have
// none, so fall back to the catalog entry with the same name.
export const entryCategory = (entry) => {
  if (entry.source === 'personal') return getCategory(entry.category);
  return getGroupCategory(entry.category || findItem(GROUP_ITEMS, entry.title)?.category);
};

// Where the money went: personal and group spending by category, largest
// first. The two sources stay separate rows (they are coloured differently).
export const breakdown = (entries) => {
  const rows = new Map();
  for (const entry of entries) {
    const category = entryCategory(entry);
    const id = `${entry.source}:${category.key}`;
    if (!rows.has(id)) {
      rows.set(id, {
        id,
        source: entry.source,
        label: category.label,
        emoji: category.emoji,
        amount: 0,
        count: 0
      });
    }
    const row = rows.get(id);
    row.amount += entry.amount;
    row.count += 1;
  }
  const total = sum(entries);
  return [...rows.values()]
    .sort((a, b) => b.amount - a.amount)
    .map(row => ({ ...row, share: total ? row.amount / total : 0 }));
};

// Running totals by day number for the current and previous period, so the
// pace of spending can be compared. The current line stops at today.
export const cumulativeSeries = (currentEntries, previousEntries, range) => {
  const perDay = (entries, start, length) => {
    const totals = new Array(length).fill(0);
    for (const entry of entries) {
      const index = daysBetween(start, entry.date);
      if (index >= 0 && index < length) totals[index] += entry.amount;
    }
    return totals;
  };

  const currentLength = range.totalDays;
  const previousLength = daysBetween(range.previous.start, range.previous.end) + 1;
  const length = Math.max(currentLength, previousLength);
  const current = perDay(currentEntries, range.start, currentLength);
  const previous = perDay(previousEntries, range.previous.start, previousLength);

  const points = [];
  let currentTotal = 0;
  let previousTotal = 0;
  for (let i = 0; i < length; i++) {
    const inCurrent = i < currentLength && i < range.elapsedDays;
    if (inCurrent) currentTotal += current[i];
    if (i < previousLength) previousTotal += previous[i];
    points.push({
      day: i + 1,
      currentDate: i < currentLength ? addDays(range.start, i) : null,
      previousDate: i < previousLength ? addDays(range.previous.start, i) : null,
      current: inCurrent ? currentTotal : null,
      previous: i < previousLength ? previousTotal : null
    });
  }
  return points;
};

// Compares this period with the previous one. While a period is still running,
// compare against the previous period at the same point (same number of days)
// rather than its full total.
export const comparePeriods = (currentTotal, series, range) => {
  const sameDay = range.inProgress ? range.elapsedDays : series.length;
  // Periods can differ in length (30- vs 31-day months, 92- vs 94-day
  // quarters). Past the end of the previous period, use its final total.
  let previousTotal = 0;
  for (let i = Math.min(sameDay, series.length) - 1; i >= 0; i--) {
    if (series[i].previous !== null) {
      previousTotal = series[i].previous;
      break;
    }
  }
  if (!previousTotal) return { previousTotal, change: null };
  return { previousTotal, change: (currentTotal - previousTotal) / previousTotal };
};

// Previous-period entries up to the same day number as the current period, so
// a period still running is compared like for like (as comparePeriods does).
export const previousAtSamePoint = (previousEntries, range) => {
  if (!range.inProgress) return previousEntries;
  const cutoff = addDays(range.previous.start, range.elapsedDays - 1);
  return previousEntries.filter(entry => startOfDay(entry.date) <= cutoff);
};

// Adds `previousAmount` and `delta` to each breakdown row. Categories with
// spending only in the previous period come back separately as `dropped`.
export const compareBreakdown = (currentRows, previousRows) => {
  const previousById = new Map(previousRows.map(row => [row.id, row]));
  const rows = currentRows.map(row => {
    const previousAmount = previousById.get(row.id)?.amount ?? 0;
    return { ...row, previousAmount, delta: row.amount - previousAmount };
  });
  const currentIds = new Set(currentRows.map(row => row.id));
  const dropped = previousRows
    .filter(row => !currentIds.has(row.id))
    .map(row => ({ ...row, amount: 0, share: 0, count: 0, previousAmount: row.amount, delta: -row.amount }));
  return { rows, dropped };
};

// The categories whose spending changed most in rupees, either way.
export const biggestMovers = (rows, limit = 3) =>
  rows
    .filter(row => Math.abs(row.delta) >= 1)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit);

// Too few days make a straight-line estimate swing wildly.
const MIN_PROJECTION_DAYS = 3;

// End-of-period estimate at the daily average so far; null when the period
// is over or has only just started.
export const projectTotal = (total, range) => {
  if (!range.inProgress || range.elapsedDays < MIN_PROJECTION_DAYS) return null;
  return (total / range.elapsedDays) * range.totalDays;
};

// Extends the pace series with a straight `projected` line from today to the
// end of the current period.
export const addProjection = (points, range, projected) => {
  if (projected === null) return points;
  const last = range.elapsedDays - 1;
  const base = points[last]?.current ?? 0;
  const rate = (projected - base) / Math.max(range.totalDays - 1 - last, 1);
  return points.map((point, i) => ({
    ...point,
    projected: i >= last && i < range.totalDays ? base + rate * (i - last) : null
  }));
};
