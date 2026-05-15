import BrowserOnly from '@docusaurus/BrowserOnly';
import { useColorMode } from '@docusaurus/theme-common';

// Distinct colours that work on both light and dark backgrounds
const SERIES_COLOURS = [
    '#e05c5c', '#5c9fe0', '#5ce07a', '#e0b45c',
    '#b45ce0', '#5ce0d8', '#e0785c', '#8de05c',
];

function interpolateAtDistance(damage, distance, d) {
    if (!damage || !distance || damage.length === 0) return null;
    if (d <= distance[0]) return damage[0];
    if (d >= distance[distance.length - 1]) return damage[damage.length - 1];
    for (let i = 1; i < distance.length; i++) {
        if (d <= distance[i]) {
            const t = (d - distance[i - 1]) / (distance[i] - distance[i - 1]);
            return damage[i - 1] + t * (damage[i] - damage[i - 1]);
        }
    }
    return damage[damage.length - 1];
}

function buildChartData(weapons) {
    // Collect all unique distance points across all weapons, normalised to metres
    const allDists = new Set();
    weapons.forEach(({ attack }) => {
        if (!attack?.distance) return;
        attack.distance.forEach(d => allDists.add(Math.max(0, Math.round(d / 100))));
    });

    // Add extra points for smooth curves between key distances
    const sorted = Array.from(allDists).sort((a, b) => a - b);
    const maxDist = sorted[sorted.length - 1] ?? 200;
    const step = maxDist <= 50 ? 1 : maxDist <= 200 ? 5 : 20;
    for (let d = 0; d <= maxDist; d += step) allDists.add(d);

    return Array.from(allDists)
        .sort((a, b) => a - b)
        .map(distM => {
            const point = { dist: distM };
            weapons.forEach(({ name, attack }) => {
                if (!attack?.damage || !attack?.distance) return;
                const distUU = attack.distance.map(x => x / 100);
                const pellets = attack.pellets ?? 1;
                const dmg = interpolateAtDistance(attack.damage, distUU, distM);
                point[name] = dmg != null ? Math.round(dmg * pellets * 10) / 10 : null;
            });
            return point;
        });
}

function Chart({ weapons }) {
    const {
        LineChart, Line, XAxis, YAxis, CartesianGrid,
        Tooltip, Legend, ResponsiveContainer,
    } = require('recharts');

    const { colorMode } = useColorMode();
    const isDark = colorMode === 'dark';

    const axisColor   = isDark ? '#aaa' : '#555';
    const gridColor   = isDark ? '#333' : '#e0e0e0';
    const bgColor     = isDark ? '#1e1e1e' : '#fff';
    const borderColor = isDark ? '#444' : '#ccc';

    const data = buildChartData(weapons);

    return (
        <div style={{ background: bgColor, borderRadius: 8, padding: '16px 8px 8px', border: `1px solid ${borderColor}`, marginBottom: 24 }}>
            <ResponsiveContainer width="100%" height={320}>
                <LineChart data={data} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis
                        dataKey="dist"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        label={{ value: 'Distance (m)', position: 'insideBottomRight', offset: -8, fill: axisColor, fontSize: 12 }}
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
                        labelFormatter={v => `${v} m`}
                        formatter={(value, name) => [`${value}`, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
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
        </div>
    );
}

/**
 * Renders a damage-vs-distance chart for one or more weapons.
 *
 * Props:
 *   weapons  — array of { name: string, attack: attackObject }
 *              where attack is the first element of w.attacks from data.json
 *
 * Usage in MDX:
 *   <DamageCurveChart weapons={flatFT
 *       .filter(w => w.category === 'Weapon.Category.AssaultRifle')
 *       .map(w => ({ name: w.name, attack: w.attacks?.[0] }))} />
 */
export default function DamageCurveChart({ weapons }) {
    if (!weapons || weapons.length === 0) return null;
    // Filter to weapons that actually have a curve (>1 data point)
    const withCurve = weapons.filter(w => w.attack?.damage?.length > 1 && w.attack?.distance?.length > 1);
    if (withCurve.length === 0) return null;
    return (
        <BrowserOnly fallback={<div style={{ height: 320 }} />}>
            {() => <Chart weapons={withCurve} />}
        </BrowserOnly>
    );
}
