// HospitalApp/src/features/analytics/charts/DonutChart.tsx
// Pure-SVG donut chart with animated segments and center label.

interface Segment {
    label: string;
    value: number;
    color: string;
}

interface DonutChartProps {
    data: Segment[];
    size?: number;
    thickness?: number;
    centerLabel?: string;
    centerValue?: string;
}

export function DonutChart({
    data,
    size = 200,
    thickness = 32,
    centerLabel,
    centerValue,
}: DonutChartProps) {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return null;

    const radius = (size - thickness) / 2;
    const circumference = 2 * Math.PI * radius;
    const center = size / 2;

    let cumulative = 0;
    const arcs = data.map((segment) => {
        const pct = segment.value / total;
        const dashLength = pct * circumference;
        const dashOffset = circumference - (cumulative / total) * circumference;
        cumulative += segment.value;
        return { ...segment, pct, dashLength, dashOffset };
    });

    return (
        <div className="flex flex-col items-center gap-4">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Background ring */}
                <circle
                    cx={center} cy={center} r={radius}
                    fill="none" stroke="#f1f5f9" strokeWidth={thickness}
                />
                {/* Segments */}
                {arcs.map((arc, i) => (
                    <circle
                        key={i}
                        cx={center} cy={center} r={radius}
                        fill="none"
                        stroke={arc.color}
                        strokeWidth={thickness}
                        strokeDasharray={`${arc.dashLength} ${circumference - arc.dashLength}`}
                        strokeDashoffset={arc.dashOffset}
                        strokeLinecap="butt"
                        transform={`rotate(-90 ${center} ${center})`}
                        style={{
                            transition: 'stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease',
                        }}
                    />
                ))}
                {/* Center text */}
                {centerValue && (
                    <>
                        <text
                            x={center} y={center - 6}
                            textAnchor="middle" dominantBaseline="central"
                            className="fill-gray-900 font-bold"
                            style={{ fontSize: '1.5rem' }}
                        >
                            {centerValue}
                        </text>
                        {centerLabel && (
                            <text
                                x={center} y={center + 16}
                                textAnchor="middle" dominantBaseline="central"
                                className="fill-gray-400"
                                style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                            >
                                {centerLabel}
                            </text>
                        )}
                    </>
                )}
            </svg>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                {data.map((d, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: d.color }}
                        />
                        <span>{d.label}</span>
                        <span className="font-semibold text-gray-800">{d.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
