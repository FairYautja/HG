import BrowserOnly from '@docusaurus/BrowserOnly';
import { useColorMode } from '@docusaurus/theme-common';

const SERIES_COLOURS = [
    '#e05c5c', '#5c9fe0', '#5ce07a', '#e0b45c',
    '#b45ce0', '#5ce0d8', '#e0785c', '#8de05c',
];

/**
 * Renders a splash damage chart for one or more grenade/explosive weapons.
 * X axis = distance from centre (metres), Y axis = damage at that distance.
 * Shows the inner (max damage) and outer (min damage) radius as vertical bands.
 *
 * Props:
 *   weapons — array of { name, directHit, splashMax, splashMin, innerRadius, outerRadius }
 *             all radii in metres
 */
function Chart({ weapons }) {
    const {
        LineChart, Line, XAxis, YAxis, CartesianGrid,
        Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea,
    } = require('recharts');

    const { colorMode } = useColorMode();
    const isDark = colorMode === 'dark';
    const axisColor   = isDark ? '#aaa' : '#555';
    const gridColor   = isDark ? '#333' : '#e0e0e0';
    const bgColor     = isDark ? '#1e1e1e' : '#fff';
    const borderColor = isDark ? '#444' : '#ccc';

    // Build per-weapon damage-vs-distance curves
    const maxRadius = Math.max(...weapons.map(w => w.outerRadius ?? 0));
    const step = maxRadius <= 10 ? 0.2 : maxRadius <= 30 ? 0.5 : 1;

    const points = [];
    for (let d = 0; d <= maxRadius + step; d = Math.round((d + step) * 100) / 100) {
        const pt = { dist: d };
        weapons.forEach(w => {
            const { name, directHit, splashMax, splashMin, innerRadius, outerRadius } = w;
            if (splashMax == null || outerRadius == null) return;
            const min = splashMin ?? 0;
            if (d === 0) {
                pt[name] = directHit ?? splashMax;
            } else if (d <= innerRadius) {
                pt[name] = splashMax;
            } else if (d <= outerRadius) {
                // linear falloff from splashMax to splashMin between inner and outer
                const t = (d - innerRadius) / (outerRadius - innerRadius);
                pt[name] = Math.round((splashMax + t * (min - splashMax)) * 10) / 10;
            } else {
                pt[name] = 0;
            }
        });
        points.push(pt);
    }

    return (
        <div style={{ background: bgColor, borderRadius: 8, padding: '16px 8px 8px', border: `1px solid ${borderColor}`, marginBottom: 24 }}>
            <ResponsiveContainer width="100%" height={280}>
                <LineChart data={points} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis
                        dataKey="dist"
                        type="number"
                        domain={[0, maxRadius]}
                        label={{ value: 'Distance from centre (m)', position: 'insideBottomRight', offset: -8, fill: axisColor, fontSize: 12 }}
                        tick={{ fill: axisColor, fontSize: 11 }}
                        tickFormatter={v => `${v}m`}
                    />
                    <YAxis
                        label={{ value: 'Damage', angle: -90, position: 'insideLeft', offset: 12, fill: axisColor, fontSize: 12 }}
                        tick={{ fill: axisColor, fontSize: 11 }}
                        width={48}
                    />
                    <Tooltip
                        contentStyle={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 6, fontSize: 12 }}
                        labelStyle={{ color: axisColor, fontWeight: 'bold' }}
                        labelFormatter={v => `${v} m from centre`}
                        formatter={(value, name) => [value > 0 ? `${value}` : '—', name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    {/* Inner radius reference lines per weapon */}
                    {weapons.map((w, i) => w.innerRadius != null && (
                        <ReferenceLine
                            key={`inner-${w.name}`}
                            x={w.innerRadius}
                            stroke={SERIES_COLOURS[i % SERIES_COLOURS.length]}
                            strokeDasharray="4 2"
                            strokeOpacity={0.5}
                        />
                    ))}
                    {weapons.map(({ name }, i) => (
                        <Line
                            key={name}
                            type="linear"
                            dataKey={name}
                            stroke={SERIES_COLOURS[i % SERIES_COLOURS.length]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                            connectNulls
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
            <p style={{ fontSize: 11, color: axisColor, margin: '4px 8px 0', opacity: 0.7 }}>
                Dashed vertical lines mark the inner radius (max damage zone). Damage drops linearly to zero at the outer radius.
            </p>
        </div>
    );
}

export default function SplashRadiusChart({ weapons }) {
    if (!weapons || weapons.length === 0) return null;
    const valid = weapons.filter(w => w.splashMax != null && w.outerRadius != null);
    if (valid.length === 0) return null;
    return (
        <BrowserOnly fallback={<div style={{ height: 280 }} />}>
            {() => <Chart weapons={valid} />}
        </BrowserOnly>
    );
}
