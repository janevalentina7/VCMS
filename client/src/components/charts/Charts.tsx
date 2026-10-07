/**
 * Recharts wrappers.
 *
 * Design notes:
 *  - Animation is subtle and short (≤600ms) so the dashboard stays fast (§31).
 *  - Colours come from the data payload where available so each category /
 *    status keeps a consistent colour across the application.
 *  - Every chart ships an accessible text summary via <figcaption> + aria-label.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '@/context/ThemeContext';
import type { MonthlyPoint } from '@/types';

const FALLBACK_COLOURS = ['#2563eb', '#0f766e', '#d97706', '#7c3aed', '#be123c', '#0284c7', '#15803d', '#475569'];

const useChartTheme = () => {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  return {
    dark,
    grid: dark ? '#273347' : '#e2e8f0',
    axis: dark ? '#94a3b8' : '#5b6a83',
    tooltip: {
      backgroundColor: dark ? '#111827' : '#ffffff',
      border: `1px solid ${dark ? '#273347' : '#d6deeb'}`,
      borderRadius: 12,
      color: dark ? '#e8eef8' : '#0f1b2d',
      fontSize: 12,
      boxShadow: '0 10px 30px -12px rgb(15 23 42 / 0.35)',
    },
  };
};

const tooltipStyle = (theme: ReturnType<typeof useChartTheme>) => ({
  contentStyle: theme.tooltip,
  labelStyle: { color: theme.axis, fontSize: 11, fontWeight: 600 },
  itemStyle: { color: theme.dark ? '#e8eef8' : '#0f1b2d', fontSize: 12 },
  cursor: { fill: theme.dark ? 'rgba(148,163,184,0.12)' : 'rgba(16,54,122,0.06)' },
});

interface CategoryDatum {
  category: string;
  count: number;
  colour?: string;
  percentage?: number;
}

export const CategoryBarChart = ({ data, onBarClick }: { data: CategoryDatum[]; onBarClick?: (name: string) => void }) => {
  const theme = useChartTheme();
  return (
    <figure className="h-full w-full" aria-label="Complaints by category">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 4 }} barCategoryGap="26%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
          <XAxis
            dataKey="category"
            tick={{ fill: theme.axis, fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
            interval={0}
            angle={-18}
            textAnchor="end"
            height={54}
            tickFormatter={(value: string) => (value.length > 14 ? `${value.slice(0, 13)}…` : value)}
          />
          <YAxis tick={{ fill: theme.axis, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={38} />
          <Tooltip {...tooltipStyle(theme)} formatter={(value: unknown, _name: unknown, entry: unknown) => {
              const percentage = (entry as { payload?: { percentage?: number } } | undefined)?.payload?.percentage;
              return [`${value} complaint(s)`, percentage ? `${percentage}% of total` : 'Count'];
            }} />
          <Bar
            dataKey="count"
            radius={[6, 6, 0, 0]}
            maxBarSize={54}
            animationDuration={600}
            onClick={(entry: unknown) => {
              const payload = entry as { payload?: CategoryDatum } | undefined;
              if (payload?.payload?.category && onBarClick) onBarClick(payload.payload.category);
            }}
          >
            {data.map((entry, index) => (
              <Cell key={entry.category} fill={entry.colour ?? FALLBACK_COLOURS[index % FALLBACK_COLOURS.length]} cursor={onBarClick ? 'pointer' : 'default'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <figcaption className="sr-only">
        {data.map((entry) => `${entry.category}: ${entry.count} complaints`).join('. ')}
      </figcaption>
    </figure>
  );
};

export const MonthlyLineChart = ({ data }: { data: MonthlyPoint[] }) => {
  const theme = useChartTheme();
  return (
    <figure className="h-full w-full" aria-label="Monthly complaint statistics">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
          <XAxis dataKey="label" tick={{ fill: theme.axis, fontSize: 10 }} tickLine={false} axisLine={{ stroke: theme.grid }} />
          <YAxis tick={{ fill: theme.axis, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={38} />
          <Tooltip {...tooltipStyle(theme)} />
          <Legend wrapperStyle={{ fontSize: 11, color: theme.axis }} iconType="circle" iconSize={8} />
          <Line type="monotone" dataKey="total" name="Registered" stroke="#2563eb" strokeWidth={2.4} dot={{ r: 2.5 }} activeDot={{ r: 5 }} animationDuration={600} />
          <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#15803d" strokeWidth={2.2} dot={{ r: 2.5 }} activeDot={{ r: 5 }} animationDuration={700} />
          <Line type="monotone" dataKey="pending" name="Pending" stroke="#d97706" strokeWidth={1.8} strokeDasharray="4 3" dot={false} animationDuration={800} />
        </LineChart>
      </ResponsiveContainer>
      <figcaption className="sr-only">
        {data.map((point) => `${point.label}: ${point.total} registered, ${point.resolved} resolved`).join('. ')}
      </figcaption>
    </figure>
  );
};

interface StatusDatum {
  label: string;
  count: number;
  colour: string;
  percentage: number;
}

export const StatusDonutChart = ({ data }: { data: StatusDatum[] }) => {
  const theme = useChartTheme();
  const total = data.reduce((sum, item) => sum + item.count, 0);
  return (
    <figure className="relative h-full w-full" aria-label="Resolved versus pending complaints">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data.filter((item) => item.count > 0)}
            dataKey="count"
            nameKey="label"
            innerRadius="58%"
            outerRadius="84%"
            paddingAngle={2}
            animationDuration={650}
            stroke={theme.dark ? '#111827' : '#ffffff'}
            strokeWidth={2}
          >
            {data
              .filter((item) => item.count > 0)
              .map((entry) => (
                <Cell key={entry.label} fill={entry.colour} />
              ))}
          </Pie>
          <Tooltip {...tooltipStyle(theme)} formatter={(value: unknown, name: unknown) => [`${value} complaint(s)`, name as string]} />
          <Legend wrapperStyle={{ fontSize: 11, color: theme.axis }} iconType="circle" iconSize={8} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
        <span className="text-2xl font-bold text-ink">{total}</span>
        <span className="text-2xs uppercase tracking-wide text-muted">Total</span>
      </div>
      <figcaption className="sr-only">
        {data.map((entry) => `${entry.label}: ${entry.count} (${entry.percentage}%)`).join('. ')}
      </figcaption>
    </figure>
  );
};

interface WardDatum {
  ward: string;
  code: string;
  count: number;
  resolved: number;
}

export const WardBarChart = ({ data }: { data: WardDatum[] }) => {
  const theme = useChartTheme();
  const sorted = [...data].sort((a, b) => b.count - a.count);
  return (
    <figure className="h-full w-full" aria-label="Ward wise complaint distribution">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 16, left: 6, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.grid} />
          <XAxis type="number" tick={{ fill: theme.axis, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="ward"
            tick={{ fill: theme.axis, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={96}
            tickFormatter={(value: string, index: number) => `${value.replace(/ —.*/, '')} (${sorted[index]?.code ?? ''})`}
          />
          <Tooltip {...tooltipStyle(theme)} formatter={(value: unknown, name: unknown) => [`${value}`, name === 'resolved' ? 'Resolved' : 'Registered']} />
          <Legend wrapperStyle={{ fontSize: 11, color: theme.axis }} iconType="circle" iconSize={8} />
          <Bar dataKey="count" name="Registered" fill="#2563eb" radius={[0, 5, 5, 0]} maxBarSize={18} animationDuration={600} />
          <Bar dataKey="resolved" name="Resolved" fill="#15803d" radius={[0, 5, 5, 0]} maxBarSize={18} animationDuration={700} />
        </BarChart>
      </ResponsiveContainer>
      <figcaption className="sr-only">
        {sorted.map((entry) => `${entry.ward}: ${entry.count} complaints, ${entry.resolved} resolved`).join('. ')}
      </figcaption>
    </figure>
  );
};

export const PriorityBarChart = ({ data }: { data: { label: string; count: number; colour: string }[] }) => {
  const theme = useChartTheme();
  return (
    <figure className="h-full w-full" aria-label="Complaints by priority">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
          <XAxis dataKey="label" tick={{ fill: theme.axis, fontSize: 10 }} tickLine={false} axisLine={{ stroke: theme.grid }} />
          <YAxis tick={{ fill: theme.axis, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={38} />
          <Tooltip {...tooltipStyle(theme)} formatter={(value: unknown) => [`${value} complaint(s)`, 'Count']} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={58} animationDuration={550}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={entry.colour} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <figcaption className="sr-only">
        {data.map((entry) => `${entry.label}: ${entry.count}`).join('. ')}
      </figcaption>
    </figure>
  );
};

export default { CategoryBarChart, MonthlyLineChart, StatusDonutChart, WardBarChart, PriorityBarChart };
