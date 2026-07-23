import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function formatDate(value) {
  return new Date(value).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' })
}

export default function MeasurementChart({ points, unit, label }) {
  const gradientId = `measurement-gradient-${useId()}`

  if (points.length === 0) {
    return <p className="measurement-empty">Pas encore de données.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={points} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--flame-2)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="var(--flame-2)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke="var(--chart-axis)"
          tick={{ fill: 'var(--chart-muted)', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis hide domain={['auto', 'auto']} />
        <Tooltip
          formatter={(value) => [`${value} ${unit}`, label]}
          labelFormatter={formatDate}
          contentStyle={{
            background: 'var(--chart-surface)',
            border: '1px solid var(--chart-axis)',
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--flame-2)"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={{ r: 3, fill: 'var(--flame-2)', stroke: 'var(--chart-surface)', strokeWidth: 1.5 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
