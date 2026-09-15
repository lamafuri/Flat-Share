import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartTooltip, { LegendItem } from './ChartTooltip';
import { SOURCE_COLORS, formatRs, formatRsCompact } from '../../utils/expenses';

const SERIES_LABELS = { personal: 'Personal', group: 'In groups' };
const GRANULARITY_LABELS = { day: 'Daily', week: 'Weekly', month: 'Monthly' };
const GAP = 2;
const RADIUS = 4;

// A stacked segment with a rounded data end on top and a surface-colored gap
// below the segment stacked above it.
function StackSegment({ x, y, width, height, fill, isTop }) {
  if (!(height > 0) || !(width > 0)) return null;
  const gap = isTop ? 0 : GAP;
  const h = height - gap;
  if (h <= 0) return null;
  const top = y + gap;
  const r = isTop ? Math.min(RADIUS, width / 2, h) : 0;
  const d = [
    `M${x},${top + h}`,
    `L${x},${top + r}`,
    `Q${x},${top} ${x + r},${top}`,
    `L${x + width - r},${top}`,
    `Q${x + width},${top} ${x + width},${top + r}`,
    `L${x + width},${top + h}`,
    'Z'
  ].join(' ');
  return <path d={d} fill={fill} />;
}

export default function SpendingOverTimeChart({ buckets, source, granularity }) {
  const [view, setView] = useState('chart');
  const series = source === 'all' ? ['personal', 'group'] : [source];

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="over-time-title">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 id="over-time-title" className="text-sm font-semibold text-ink-100">Spending over time</h2>
          <p className="text-xs text-ink-500 mt-0.5">
            {GRANULARITY_LABELS[granularity]} totals{series.length === 1 ? ` · ${SERIES_LABELS[series[0]]}` : ''}
          </p>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {view === 'chart' ? (
        <>
          {series.length > 1 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
              {series.map(key => <LegendItem key={key} color={SOURCE_COLORS[key]} label={SERIES_LABELS[key]} />)}
            </div>
          )}
          <div className="h-60 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
                <CartesianGrid vertical={false} stroke="#1c1c26" />
                <XAxis
                  dataKey="tick"
                  tickLine={false}
                  axisLine={{ stroke: '#2a2a38' }}
                  tick={{ fill: '#8080a0', fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={10}
                />
                <YAxis
                  tickFormatter={formatRsCompact}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#8080a0', fontSize: 11 }}
                  width={64}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload;
                    return (
                      <ChartTooltip
                        title={row.label}
                        rows={series.map(key => ({ name: SERIES_LABELS[key], value: row[key], color: SOURCE_COLORS[key] }))}
                        footer={series.length > 1 ? `Total ${formatRs(row.total)}` : undefined}
                      />
                    );
                  }}
                />
                {series.map(key => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={SERIES_LABELS[key]}
                    stackId="spend"
                    fill={SOURCE_COLORS[key]}
                    maxBarSize={24}
                    isAnimationActive={false}
                    shape={(props) => (
                      <StackSegment
                        {...props}
                        // Personal sits below groups; it is the top segment only when there is no group spend.
                        isTop={key === series[series.length - 1] || !(props.payload.group > 0)}
                      />
                    )}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-ink-900">
              <tr className="text-xs text-ink-500 text-left">
                <th className="font-medium py-2 pr-3">Period</th>
                {series.map(key => <th key={key} className="font-medium py-2 px-3 text-right">{SERIES_LABELS[key]}</th>)}
                {series.length > 1 && <th className="font-medium py-2 pl-3 text-right">Total</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800 tabular-nums">
              {buckets.filter(b => !b.future).map(bucket => (
                <tr key={bucket.key}>
                  <td className="py-2 pr-3 text-ink-300 whitespace-nowrap">{bucket.label}</td>
                  {series.map(key => <td key={key} className="py-2 px-3 text-right text-ink-200">{formatRs(bucket[key])}</td>)}
                  {series.length > 1 && <td className="py-2 pl-3 text-right text-ink-100 font-medium">{formatRs(bucket.total)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ViewToggle({ view, onChange }) {
  return (
    <div className="flex p-0.5 bg-ink-800 rounded-lg shrink-0" role="group" aria-label="Display as">
      {['chart', 'table'].map(option => (
        <button
          key={option}
          onClick={() => onChange(option)}
          aria-pressed={view === option}
          className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors touch-manipulation ${
            view === option ? 'bg-ink-700 text-ink-100' : 'text-ink-500 hover:text-ink-300'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
