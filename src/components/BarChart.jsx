/**
 * BarChart — lightweight SVG grouped bar chart, no external charting lib.
 *
 * Props
 *   labels   string[]    — x-axis labels (one per group)
 *   series   { name, color, values: number[] }[]
 *            — one series per bar type; negative values draw below the zero line
 *   height   number      — SVG pixel height (default 180)
 *   legend   boolean     — show legend below chart (default true)
 */
export function BarChart({ labels = [], series = [], height = 180, legend = true }) {
  if (!labels.length || !series.length) return null

  const W = 420
  const H = height
  const PAD = { top: 16, right: 8, bottom: legend ? 52 : 30, left: 52 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const allValues = series.flatMap((s) => s.values)
  const rawMax = Math.max(...allValues, 0)
  const rawMin = Math.min(...allValues, 0)

  // Round axis bounds up to a "nice" number so bars don't hit the ceiling
  const niceMax = niceNumber(rawMax * 1.12)
  const niceMin = rawMin < 0 ? -niceNumber(Math.abs(rawMin) * 1.12) : 0
  const range = niceMax - niceMin || 1

  const scaleY = (v) => PAD.top + chartH * (1 - (v - niceMin) / range)
  const zeroY = scaleY(0)

  const numGroups = labels.length
  const numSeries = series.length
  const groupW = chartW / numGroups
  // Leave some gap on each side of the bar group
  const totalBarW = groupW * 0.72
  const barW = Math.max(3, totalBarW / numSeries)

  // Y-axis ticks (5 steps)
  const tickCount = 5
  const tickStep = (niceMax - niceMin) / tickCount
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => niceMin + tickStep * i)

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={height}
        className="overflow-visible"
        aria-label="Bar chart"
      >
        {/* Horizontal grid lines + Y labels */}
        {ticks.map((v, i) => {
          const y = scaleY(v)
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={y}
                x2={W - PAD.right}
                y2={y}
                stroke={v === 0 ? '#9ca3af' : '#f3f4f6'}
                strokeWidth={v === 0 ? 1.5 : 1}
              />
              <text
                x={PAD.left - 5}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={9}
                fill="#9ca3af"
              >
                {formatY(v)}
              </text>
            </g>
          )
        })}

        {/* Bars and X labels */}
        {labels.map((label, gi) => {
          const groupX = PAD.left + gi * groupW + (groupW - totalBarW) / 2
          return (
            <g key={gi}>
              {series.map((s, si) => {
                const value = s.values[gi] ?? 0
                const isNeg = value < 0
                const barTop = Math.min(scaleY(value), zeroY)
                const barH = Math.max(1, Math.abs(scaleY(value) - zeroY))
                const bx = groupX + si * barW

                return (
                  <g key={si}>
                    <rect
                      x={bx + 1}
                      y={barTop}
                      width={barW - 2}
                      height={barH}
                      fill={isNeg ? '#ef4444' : s.color}
                      rx={2}
                      opacity={0.9}
                    />
                    {/* Value label on the bar if space allows */}
                    {barH > 18 && (
                      <text
                        x={bx + barW / 2}
                        y={barTop + (isNeg ? barH - 4 : 4)}
                        textAnchor="middle"
                        dominantBaseline={isNeg ? 'auto' : 'hanging'}
                        fontSize={8}
                        fill="white"
                        fontWeight="600"
                      >
                        {formatY(value)}
                      </text>
                    )}
                  </g>
                )
              })}

              {/* X-axis label */}
              <text
                x={groupX + totalBarW / 2}
                y={H - PAD.bottom + 10}
                textAnchor="middle"
                fontSize={9}
                fill="#6b7280"
              >
                {label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      {legend && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-1">
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatY(v) {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(1) + 'M'
  if (abs >= 1_000) return sign + (abs / 1_000).toFixed(0) + 'K'
  return sign + abs.toFixed(0)
}

// Round up to a "nice" ceiling: next multiple of 1/5/10/50/100...
function niceNumber(x) {
  if (x === 0) return 10
  const magnitude = Math.pow(10, Math.floor(Math.log10(x)))
  const fraction = x / magnitude
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return nice * magnitude
}
