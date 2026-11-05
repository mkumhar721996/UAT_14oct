const LABEL_WIDTH = 88
const MAX_BAR = 270
const ROW = 36

/** Horizontal bars of spend per category (largest first); bar widths are relative to the largest. */
export function SpendChart({
  data,
  periodLabel,
  format,
}: {
  data: { category: string; cents: number }[]
  periodLabel: string
  format: (cents: number) => string
}) {
  if (data.length === 0) {
    return (
      <svg className="chart" viewBox="0 0 460 36" role="img" aria-label={`Spend by category, ${periodLabel}: no spending`}>
        <text className="lbl" x="0" y="22">
          No spending in this period
        </text>
      </svg>
    )
  }
  const max = data[0].cents
  const summary = data.map((d) => `${d.category} ${format(d.cents)}`).join(', ')
  return (
    <svg className="chart" viewBox={`0 0 460 ${data.length * ROW + 8}`} role="img" aria-label={`Spend by category, ${periodLabel}: ${summary}`}>
      {data.map((d, i) => {
        const y = 8 + i * ROW
        const width = max > 0 ? Math.round((d.cents / max) * MAX_BAR) : 0
        return (
          <g key={d.category}>
            <text className="lbl" x="0" y={y + 14}>
              {d.category}
            </text>
            <rect className="bar" x={LABEL_WIDTH} y={y} width={width} height="20" rx="2" />
            <text className="val" x={LABEL_WIDTH + 8 + width} y={y + 14}>
              {format(d.cents)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
