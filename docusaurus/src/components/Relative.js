export default function Relative(key, data, modify_keys = {}) {
    const values = data.map(value => value[key]);
    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);

    return function format(row) {
        const modify = modify_keys[row.id] !== undefined ? modify_keys[row.id] : {};
        const value_overriden = typeof modify.value !== "undefined";
        let value = value_overriden ? modify.value : row[key];
        const source = value_overriden ? modify.source || "tested in game" : row.id;
        const title = `${source}: ${value}`;

        const style = { fontWeight: "bold" };
        if (modify.style) {
            for (const [style_key, style_value] of Object.entries(modify.style)) {
                style[style_key] = style_value;
            }
        }

        if (modify.callback) {
            value = modify.callback(value);
        }

        if (typeof value !== 'number') {
            return <span style={style} title={title}>{value}</span>;
        }
        const percent = (value - min) / (max - min) * 100;
        return <div>
            <span style={style} title={title}>{value}</span><br />
            <progress value={percent} max="100" style={{ width: '60px' }}>{percent}%</progress>
        </div>;
    }
}
