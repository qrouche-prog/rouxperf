import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function fmtWeek(iso) {
  return new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' })
}

// Volume hebdomadaire des séances importées (métrique choisie : minutes, km ou séances).
export default function WeeklyLoadChart({ data, metricKey = 'min', unit = 'min', height = 160 }) {
  if (!data || data.length === 0) {
    return <p className="measurement-empty">Pas encore de données.</p>
  }
  const suffix = unit ? ` ${unit}` : ''
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis
          dataKey="week"
          tickFormatter={fmtWeek}
          stroke="var(--chart-axis)"
          tick={{ fill: 'var(--chart-muted)', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          minTickGap={8}
        />
        <YAxis hide domain={[0, 'auto']} />
        <Tooltip
          formatter={(value) => [`${value}${suffix}`, 'Volume']}
          labelFormatter={fmtWeek}
          contentStyle={{
            background: 'var(--chart-surface)',
            border: '1px solid var(--chart-axis)',
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Bar dataKey={metricKey} fill="var(--flame-2)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
