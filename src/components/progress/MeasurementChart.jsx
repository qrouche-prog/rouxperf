import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const UNITS = {
  weight_kg: 'kg',
  body_fat_pct: '%',
  waist_cm: 'cm',
  hips_cm: 'cm',
  chest_cm: 'cm',
  arm_cm: 'cm',
  thigh_cm: 'cm',
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' })
}

export default function MeasurementChart({ data, field, label }) {
  const unit = UNITS[field] ?? ''
  const points = data.filter((entry) => entry[field] != null).map((entry) => ({ date: entry.measured_at, value: entry[field] }))

  if (points.length === 0) {
    return <p>Pas encore de données pour « {label} ».</p>
  }

  return (
    <div>
      <h3>{label}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke="var(--chart-axis)"
            tick={{ fill: 'var(--chart-muted)', fontSize: 12 }}
          />
          <YAxis stroke="var(--chart-axis)" tick={{ fill: 'var(--chart-muted)', fontSize: 12 }} width={44} />
          <Tooltip
            formatter={(value) => [`${value} ${unit}`, label]}
            labelFormatter={formatDate}
            contentStyle={{
              background: 'var(--chart-surface)',
              border: '1px solid var(--chart-axis)',
              borderRadius: 6,
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--chart-line)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'var(--chart-line)', stroke: 'var(--chart-surface)', strokeWidth: 2 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
