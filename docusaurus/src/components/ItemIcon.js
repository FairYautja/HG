import { useColorMode } from '@docusaurus/theme-common';

export const selectStyle = { width: '100%', padding: '4px 6px', fontSize: '1rem' };

/** Game icon, inverted in light mode like the table icons. */
export default function ItemIcon({ icon, size = 24 }) {
    const { colorMode } = useColorMode();
    if (!icon) return null;
    return <img src={icon} alt="" style={{ width: size, height: size, verticalAlign: 'middle', filter: `invert(${colorMode === 'dark' ? 0 : 0.7})` }} />;
}
