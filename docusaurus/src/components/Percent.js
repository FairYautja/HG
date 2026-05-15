export default function Percent(key, modify_keys = {}) {
    return function format(row) {
        const modify = modify_keys[row.id] !== undefined ? modify_keys[row.id] : {};
        const value_overriden = typeof modify.value !== "undefined";
        let value = value_overriden ? modify.value : row[key];
        const source = value_overriden ? modify.source || "tested in game" : row.id;
        const title = `${source}: ${value}`;
        const GOOD = value_overriden ? "#007d75" : "#218409";
        const BAD = value_overriden ? "#cb00dd" : "#f0001f";

        const style = { fontWeight: "bold" };
        if (modify.style) {
            for (const [style_key, style_value] of Object.entries(modify.style)) {
                style[style_key] = style_value;
            }
        }

        if (modify.callback) {
            value = modify.callback(value);
        }

        if (!style.color) {
            if (modify.good) {
                style.color = GOOD;
            } else if (modify.bad) {
                style.color = BAD;
            } else if (modify.bad_positive) {
                style.color = value > 1 ? BAD : GOOD;
            } else if (modify.good_negative) {
                style.color = value < 1 ? GOOD : BAD;
            } else {
                style.color = value > 1 ? GOOD : BAD;
            }
        }

        if (typeof value !== 'number') {
            return <span style={style} title={title}>{value}</span>;
        }

        if (value >= 2.0) {
            return <span style={style} title={title}>x{value}</span>;
        }
        if (value > 1.0) {
            return <span style={style} title={title}>+{Math.round((value - 1) * 100)}%</span>;
        }
        if (value < 1.0) {
            return <span style={style} title={title}>-{Math.round((1 - value) * 100)}%</span>;
        }
        return '';
    }
}
