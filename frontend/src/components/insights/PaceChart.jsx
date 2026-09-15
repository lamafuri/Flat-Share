import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartTooltip, { LegendItem } from './ChartTooltip';
import { CHART_SURFACE, PERIOD_COLORS, formatRs, formatRsCompact } from '../../utils/expenses';
import { formatBS, formatBSShort } from '../../utils/nepaliDate';

// Running total for this period against the previous one, by day number, so
// the reader can see whether they are spending faster or slower than before.
export default function PaceChart({ points, currentName, previousName, currentTotal, previousAtSamePoint }) {
  const lastCurrentIndex = points.reduce((last, point, i) => (point.current !== null ? i : last), -1);

  const tickFor = (day) => {
    const point = points[day - 1];
    return point?.currentDate ? formatBSShort(point.currentDate) : `Day ${day}`;
  };

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="pace-title">
      <div className="mb-3">
        <h2 id="pace-title" className="text-sm font-semibold text-ink-100">Spending pace</h2>
        <p className="text-xs text-ink-500 mt-0.5">Running total compared with {previousName.toLowerCase()}</p>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
        <LegendItem shape="line" color={PERIOD_COLORS.current} label={currentName} value={formatRs(currentTotal)} />
        <LegendItem shape="line" color={PERIOD_COLORS.previous} label={`${previousName}, same point`} value={formatRs(previousAtSamePoint)} />
      </div>

      <div className="h-56 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#1c1c26" />
            <XAxis
              dataKey="day"
              tickFormatter={tickFor}
              tickLine={false}
              axisLine={{ stroke: '#2a2a38' }}
              tick={{ fill: '#8080a0', fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={28}
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
              cursor={{ stroke: '#3d3d52', strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload;
                const rows = [];
                if (point.current !== null) {
                  rows.push({ name: `${currentName} · ${formatBS(point.currentDate, { withYear: false })}`, value: point.current, color: PERIOD_COLORS.current });
                }
                if (point.previous !== null) {
                  rows.push({ name: `${previousName} · ${formatBS(point.previousDate, { withYear: false })}`, value: point.previous, color: PERIOD_COLORS.previous });
                }
                return <ChartTooltip title={`Day ${point.day}`} rows={rows} />;
              }}
            />
            <Line
              type="monotone"
              dataKey="previous"
              name={previousName}
              stroke={PERIOD_COLORS.previous}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 4, fill: PERIOD_COLORS.previous, stroke: CHART_SURFACE, strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="current"
              name={currentName}
              stroke={PERIOD_COLORS.current}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              connectNulls={false}
              // Mark where "today" is on the current line.
              dot={({ index, cx, cy }) =>
                index === lastCurrentIndex && cx != null && cy != null
                  ? <circle key="end" cx={cx} cy={cy} r={4} fill={PERIOD_COLORS.current} stroke={CHART_SURFACE} strokeWidth={2} />
                  : <g key={index} />
              }
              activeDot={{ r: 4, fill: PERIOD_COLORS.current, stroke: CHART_SURFACE, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
