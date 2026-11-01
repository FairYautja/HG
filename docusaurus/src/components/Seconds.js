// Formatter for computed durations: value in seconds with a relative bar and a tooltip
// explaining how it was calculated.

/**
 * @param key      row field holding the duration in seconds
 * @param rows     all rows, used to scale the bar
 * @param explain  optional (row) => string shown as tooltip
 */
export default function Seconds(key, rows, explain = null) {
    const values = rows.map((r) => r[key]).filter((v) => typeof v === 'number' && isFinite(v));
    const min = Math.min(...values);
    const max = Math.max(...values);

    return function format(row) {
        const value = row[key];
        if (typeof value !== 'number' || !isFinite(value)) return null;
        const percent = max === min ? 100 : Math.round((value - min) / (max - min) * 100);
        return (
            <div title={explain ? explain(row) : undefined}>
                <strong>{value} s</strong><br />
                <progress value={percent} max="100" style={{ width: '60px' }}>{percent}%</progress>
            </div>
        );
    };
}

/** Round to one decimal place, null when not computable */
export function ratio(a, b) {
    if (a == null || b == null || b === 0) return null;
    return Math.round(a / b * 10) / 10;
}
