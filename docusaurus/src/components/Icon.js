import {useColorMode} from '@docusaurus/theme-common';

export default function Icon(key) {
    return function format(row) {
        const {colorMode} = useColorMode();
        const value = row[key];
        const title = row.source || row.id;
        if (!row.icon) {
            return <span title={title}>{value}</span>;
        }

        return <span className="icon" title={title}><img src={row.icon} style={{ filter: `invert(${colorMode === 'dark' ? 0 : .7})` }} /> {value}</span>;
    }
}
