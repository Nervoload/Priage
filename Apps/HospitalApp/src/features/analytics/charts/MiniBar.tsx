// HospitalApp/src/features/analytics/charts/MiniBar.tsx
// Small inline progress-style bar used inside metric cards.

interface MiniBarProps {
    value: number;
    max: number;
    color?: string;
    height?: number;
}

export function MiniBar({ value, max, color = '#1e3a5f', height = 6 }: MiniBarProps) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;

    return (
        <div
            className="w-full rounded-full bg-gray-100 overflow-hidden"
            style={{ height }}
        >
            <div
                className="h-full rounded-full"
                style={{
                    width: `${pct}%`,
                    backgroundColor: color,
                    transition: 'width 0.5s ease',
                }}
            />
        </div>
    );
}
