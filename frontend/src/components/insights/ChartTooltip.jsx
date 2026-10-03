import { formatRs } from '../../utils/expenses';

// Tooltip frame shared by the insight charts. Values lead in strong text;
// series names follow in secondary text, keyed by a short line in the series
// color (text itself never takes the series color).
export default function ChartTooltip({ title, rows, footer }) {
  return (
    <div className="bg-ink-800 border border-ink-700 rounded-lg shadow-card px-3 py-2 min-w-[150px] pointer-events-none">
      <p className="text-xs text-ink-400 mb-1.5">{title}</p>
      <ul className="space-y-1">
        {rows.map(row => (
          <li key={row.name} className="flex items-center gap-2">
            <span className="w-3 h-0.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} aria-hidden />
            <span className="text-sm font-semibold text-ink-100">{formatRs(row.value)}</span>
            <span className="text-xs text-ink-400 truncate">{row.name}</span>
          </li>
        ))}
      </ul>
      {footer && <p className="text-xs text-ink-400 mt-1.5 pt-1.5 border-t border-ink-700">{footer}</p>}
    </div>
  );
}

export function LegendItem({ color, label, shape = 'rect', value }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-400">
      {shape === 'dash' ? (
        <span className="w-3 h-0.5 shrink-0" style={{ backgroundImage: `linear-gradient(to right, ${color} 50%, transparent 50%)`, backgroundSize: '6px 2px' }} aria-hidden />
      ) : (
        <span
          className={shape === 'line' ? 'w-3 h-0.5 rounded-full' : 'w-2.5 h-2.5 rounded-sm'}
          style={{ backgroundColor: color }}
          aria-hidden
        />
      )}
      {label}
      {value !== undefined && <span className="text-ink-200 font-medium">{value}</span>}
    </span>
  );
}
