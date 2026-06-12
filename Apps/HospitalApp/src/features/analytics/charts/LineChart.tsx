// HospitalApp/src/features/analytics/charts/LineChart.tsx
// Pure-SVG line / area chart with optional secondary series.

interface LinePoint {
    label: string;
    value: number;
    value2?: number;
}

interface LineChartProps {
    data: LinePoint[];
    height?: number;
    lineColor?: string;
    line2Color?: string;
    areaColor?: string;
    unit?: string;
    line2Label?: string;
}

export function LineChart({
    data,
    height = 200,
    lineColor = '#1e3a5f',
    line2Color = '#f97316',
    areaColor = 'rgba(30, 58, 95, 0.08)',
    unit = '',
    line2Label,
}: LineChartProps) {
    if (data.length === 0) return null;

    const padding = { top: 16, right: 20, bottom: 30, left: 40 };
    const width = 560;
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const allValues = data.flatMap((d) => [d.value, ...(d.value2 != null ? [d.value2] : [])]);
    const maxVal = Math.max(...allValues, 1) * 1.1;

    const xStep = chartW / Math.max(data.length - 1, 1);

    const toX = (i: number) => padding.left + i * xStep;
    const toY = (v: number) => padding.top + chartH - (v / maxVal) * chartH;

    const buildPath = (key: 'value' | 'value2') =>
        data
            .map((d, i) => {
                const v = key === 'value2' ? (d.value2 ?? 0) : d.value;
                return `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(v)}`;
            })
            .join(' ');

    const areaPath =
        buildPath('value') +
        ` L${toX(data.length - 1)},${padding.top + chartH} L${toX(0)},${padding.top + chartH} Z`;

    return (
        <div className="flex flex-col gap-2">
            <svg
                width="100%"
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="xMidYMid meet"
            >
                {/* Y-axis grid */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                    const y = padding.top + chartH - pct * chartH;
                    const val = Math.round(pct * maxVal);
                    return (
                        <g key={pct}>
                            <line
                                x1={padding.left}
                                x2={width - padding.right}
                                y1={y} y2={y}
                                stroke="#f1f5f9"
                                strokeWidth={1}
                            />
                            <text
                                x={padding.left - 6}
                                y={y}
                                textAnchor="end"
                                dominantBaseline="central"
                                className="fill-gray-400"
                                style={{ fontSize: '0.72rem' }}
                            >
                                {val}{unit}
                            </text>
                        </g>
                    );
                })}

                {/* Area fill */}
                <path d={areaPath} fill={areaColor} />

                {/* Primary line */}
                <path d={buildPath('value')} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

                {/* Secondary line (optional) */}
                {data.some((d) => d.value2 != null) && (
                    <path
                        d={buildPath('value2')}
                        fill="none"
                        stroke={line2Color}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="6 3"
                    />
                )}

                {/* Dots + labels */}
                {data.map((d, i) => (
                    <g key={i}>
                        <circle cx={toX(i)} cy={toY(d.value)} r={3.5} fill={lineColor} />
                        {d.value2 != null && (
                            <circle cx={toX(i)} cy={toY(d.value2)} r={3} fill={line2Color} />
                        )}
                        <text
                            x={toX(i)}
                            y={padding.top + chartH + 16}
                            textAnchor="middle"
                            className="fill-gray-400"
                            style={{ fontSize: '0.72rem' }}
                        >
                            {d.label}
                        </text>
                    </g>
                ))}
            </svg>

            {/* Legend for two-line mode */}
            {line2Label && (
                <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                        <span className="w-4 h-0.5 rounded" style={{ backgroundColor: lineColor }} />
                        All CTAS
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-4 h-0.5 rounded border-dashed" style={{ backgroundColor: line2Color, borderBottom: `2px dashed ${line2Color}`, height: 0 }} />
                        {line2Label}
                    </span>
                </div>
            )}
        </div>
    );
}
