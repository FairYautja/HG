export default function Modifier(key, bad_positive = [], good_negative = []) {
    return function format(row) {
        const value = row[key];
        if (typeof value !== 'number') {
            return value;
        }

        const style = {};
        if (Array.isArray(bad_positive) && bad_positive.includes(row.id)) {
            style.color = value > 1 ? 'red' : 'green';
        } else if (Array.isArray(good_negative) && good_negative.includes(row.id)) {
            style.color = value < 1 ? 'green' : 'red';
        }

        if (value === +value && value === (value|0)) {
            if (value > 0) {
                return <span style={style}>+{value}</span>;
            }
            return <span style={style}>{value}</span>;
        }
        if (value >= 2.0) {
            return <span style={style}>x{value}</span>;
        }
        if (value > 1.0) {
            return <span style={style}>+{Math.round((value - 1) * 100)}%</span>;
        }
        if (value < 1.0) {
            return <span style={style}>-{Math.round((1 - value) * 100)}%</span>;
        }
        return '';
    }
}
