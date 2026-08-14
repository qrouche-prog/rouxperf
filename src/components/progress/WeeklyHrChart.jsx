import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function fmtWeek(iso) {
  return new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' })
}

// FC moyenne par semaine (bpm) des séances importées. Ligne, trous comblés.
export default function WeeklyHrChart({ data, height = 160 }) {
  if (!data || data.length === 0) {
    return <p className="measurement-empty">Pas encore de données.</p>
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
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
        <YAxis
          domain={['dataMin - 5', 'dataMax + 5']}
          stroke="var(--chart-axis)"
          tick={{ fill: 'var(--chart-muted)', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <Tooltip
          formatter={(value) => [`${value} bpm`, 'FC moy.']}
          labelFormatter={fmtWeek}
          contentStyle={{
            background: 'var(--chart-surface)',
            border: '1px solid var(--chart-axis)',
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey="hr"
          stroke="var(--flame-2)"
          strokeWidth={2}
          dot={{ r: 3, fill: 'var(--flame-2)' }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
