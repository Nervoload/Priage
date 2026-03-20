// HospitalApp/src/features/analytics/charts/BarChart.tsx
// Pure-SVG bar chart — supports vertical and horizontal orientations.

interface BarDatum {
    label: string;
    value: number;
    color?: string;
}

interface BarChartProps {
    data: BarDatum[];
    orientation?: 'vertical' | 'horizontal';
    height?: number;
    barColor?: string;
    showValues?: boolean;
}

export function BarChart({
    data,
    orientation = 'vertical',
    height = 200,
    barColor = '#1e3a5f',
    showValues = true,
}: BarChartProps) {
    if (data.length === 0) return null;
    const maxVal = Math.max(...data.map((d) => d.value), 1);

    // ── Horizontal bars ──────────────────────────────────────────────────────
    if (orientation === 'horizontal') {
        const rowH = 28;
        const labelW = 150;
        const chartW = 320;
        const totalH = data.length * rowH + 4;

        return (
            <svg
                width="100%"
                height={totalH}
                viewBox={`0 0 ${labelW + chartW + 50} ${totalH}`}
                preserveAspectRatio="xMinYMin meet"
            >
                {data.map((d, i) => {
                    const barW = (d.value / maxVal) * chartW;
                    const y = i * rowH + 2;
                    return (
                        <g key={i}>
                            {/* Label */}
                            <text
                                x={labelW - 8}
                                y={y + rowH / 2}
                                textAnchor="end"
                                dominantBaseline="central"
                                className="fill-gray-600"
                                style={{ fontSize: '0.84rem' }}
                            >
                                {d.label}
                            </text>
                            {/* Bar */}
                            <rect
                                x={labelW}
                                y={y + 4}
                                width={barW}
                                height={rowH - 8}
                                rx={4}
                                fill={d.color ?? barColor}
                                style={{ transition: 'width 0.5s ease' }}
                            />
                            {/* Value */}
                            {showValues && (
                                <text
                                    x={labelW + barW + 6}
                                    y={y + rowH / 2}
                                    dominantBaseline="central"
                                    className="fill-gray-500 font-medium"
                                    style={{ fontSize: '0.78rem' }}
                                >
                                    {d.value}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
        );
    }

    // ── Vertical bars ────────────────────────────────────────────────────────
    const padding = 40;
    const barGap = 4;
    const chartWidth = Math.max(data.length * 36, 300);
    const barW = Math.min((chartWidth - padding * 2) / data.length - barGap, 28);
    const chartH = height - 30;

    return (
        <svg
            width="100%"
            height={height}
            viewBox={`0 0 ${chartWidth} ${height}`}
            preserveAspectRatio="xMidYMax meet"
        >
            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1].map((pct) => (
                <line
                    key={pct}
                    x1={padding}
                    x2={chartWidth - 10}
                    y1={chartH - pct * (chartH - 10)}
                    y2={chartH - pct * (chartH - 10)}
                    stroke="#f1f5f9"
                    strokeWidth={1}
                />
            ))}
            {data.map((d, i) => {
                const barH = (d.value / maxVal) * (chartH - 10);
                const x = padding + i * (barW + barGap) + barGap / 2;
                const y = chartH - barH;
                return (
                    <g key={i}>
                        <rect
                            x={x}
                            y={y}
                            width={barW}
                            height={barH}
                            rx={3}
                            fill={d.color ?? barColor}
                            style={{ transition: 'height 0.5s ease, y 0.5s ease' }}
                        />
                        {/* Label */}
                        <text
                            x={x + barW / 2}
                            y={chartH + 14}
                            textAnchor="middle"
                            className="fill-gray-400"
                            style={{ fontSize: '0.66rem' }}
                        >
                            {d.label}
                        </text>
                        {/* Value on top */}
                        {showValues && d.value > 0 && (
                            <text
                                x={x + barW / 2}
                                y={y - 4}
                                textAnchor="middle"
                                className="fill-gray-500"
                                style={{ fontSize: '0.66rem' }}
                            >
                                {d.value}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}
