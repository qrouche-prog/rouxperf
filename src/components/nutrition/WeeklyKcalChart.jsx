import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function fmtDay(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-CH', { weekday: 'short' })
}

// Calories par jour sur la dernière semaine, avec la cible en ligne de repère.
export default function WeeklyKcalChart({ data, target, height = 150 }) {
  if (!data || data.length === 0) {
    return <p className="measurement-empty">Pas encore de données.</p>
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis
          dataKey="day"
          tickFormatter={fmtDay}
          stroke="var(--chart-axis)"
          tick={{ fill: 'var(--chart-muted)', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis hide domain={[0, 'auto']} />
        {target > 0 && <ReferenceLine y={target} stroke="var(--chart-axis)" strokeDasharray="4 3" />}
        <Tooltip
          formatter={(v) => [`${v} kcal`, '']}
          labelFormatter={(iso) =>
            new Date(`${iso}T00:00:00`).toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'short' })
          }
          contentStyle={{
            background: 'var(--chart-surface)',
            border: '1px solid var(--chart-axis)',
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Bar dataKey="kcal" fill="var(--flame-2)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
