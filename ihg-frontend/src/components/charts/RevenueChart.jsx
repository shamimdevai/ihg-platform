import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// Requires `recharts` as an npm dependency (locked-in stack choice,
// "Recharts (Phase 23+ only)" — see docs/PROGRESS.md's Locked-in
// decisions). If it isn't already installed in the frontend container,
// add it via `docker compose exec frontend npm install recharts` per
// the Global Context Prompt's npm-install gotcha — editing package.json
// on the host alone won't reach the container's isolated node_modules.

// Bar colors: brand navy (#1F3A5F) / brand red (#FF2147) for the first
// two bars, plus one neutral third color — the brand only defines two
// colors, and this chart can show up to three bars (Hotel/Restaurant/
// Delivery) depending on which modules are currently enabled.
const BAR_COLORS = ['#1F3A5F', '#FF2147', '#0EA5E9']

/**
 * `data` shape: [{ module: 'Hotel', revenue: 1234.5 }, ...] — one entry
 * per currently-ENABLED module only (the caller filters by
 * isModuleEnabled() before passing data in here; this component has no
 * module-toggle awareness of its own). This is a per-range aggregate
 * comparison, not a real time series — GET /reporting/dashboard returns
 * one summed revenue figure per module for the whole date_from–date_to
 * window, not a day-by-day breakdown, so a bar-per-module comparison is
 * the honest chart for the data actually available.
 */
export default function RevenueChart({ data, currency }) {
  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No enabled modules to compare, or no revenue data for this range.
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="module" />
        <YAxis />
        <Tooltip
          formatter={(value) => [
            `${Number(value).toFixed(2)}${currency ? ` ${currency}` : ''}`,
            'Revenue',
          ]}
        />
        <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={entry.module} fill={BAR_COLORS[index % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}