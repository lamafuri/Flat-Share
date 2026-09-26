import { useState } from 'react';
import { LegendItem } from './ChartTooltip';
import { SOURCE_COLORS, formatRs } from '../../utils/expenses';

const COLLAPSED_ROWS = 6;

// Ranked horizontal bars: spending per category, personal (blue) and in
// groups (orange). Every value is printed, so this doubles as the table.
export default function BreakdownList({ rows, showSourceLegend }) {
  const [expanded, setExpanded] = useState(false);
  const max = rows[0]?.amount || 1;
  const visible = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="breakdown-title">
      <div className="mb-3">
        <h2 id="breakdown-title" className="text-sm font-semibold text-ink-100">Where it went</h2>
        <p className="text-xs text-ink-500 mt-0.5">Personal and group spending by category</p>
      </div>

      {showSourceLegend && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
          <LegendItem color={SOURCE_COLORS.personal} label="Personal" />
          <LegendItem color={SOURCE_COLORS.group} label="In groups" />
        </div>
      )}

      <ul className="space-y-3">
        {visible.map(row => (
          <li key={row.id}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="flex items-center gap-2 min-w-0 text-sm text-ink-200">
                <span aria-hidden>{row.emoji}</span>
                <span className="truncate">{row.label}</span>
              </span>
              <span className="shrink-0 text-sm text-ink-100 font-medium tabular-nums">
                {formatRs(row.amount)}{' '}
                <span className="text-xs text-ink-500 font-normal ml-1">{Math.round(row.share * 100)}%</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-ink-800 overflow-hidden" aria-hidden>
              <div
                className="h-full rounded-r"
                style={{ width: `${Math.max((row.amount / max) * 100, 1)}%`, backgroundColor: SOURCE_COLORS[row.source] }}
              />
            </div>
          </li>
        ))}
      </ul>

      {rows.length > COLLAPSED_ROWS && (
        <button onClick={() => setExpanded(e => !e)} className="mt-3 text-xs font-medium text-accent hover:text-accent-light touch-manipulation py-1">
          {expanded ? 'Show less' : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  );
}
