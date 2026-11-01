// Body part (damage zone) modifiers for characters and attacker damage types.
//
// Modifiers are incoming damage multipliers: anything above 1 means the victim
// takes more damage when hit in that zone.

const LIMBS = {
    head: ['Head'],
    body: ['Body'],
    arms: ['LeftArm', 'RightArm'],
    legs: ['LeftLeg', 'RightLeg'],
};

function zoneValue(zones, keys) {
    const values = keys.map((k) => zones?.[k]).filter((v) => v != null);
    if (!values.length) return null;
    // Left and right sides are the same in game data so far; fall back to the
    // stronger one if they ever differ.
    return Math.max(...values);
}

/** Add head/body/arms/legs fields to each row; missing zones stay null */
export function withZones(rows) {
    return rows.map((row) => {
        const zones = {};
        for (const [limb, keys] of Object.entries(LIMBS)) {
            zones[limb] = zoneValue(row.damage_zones, keys);
        }
        return { ...row, ...zones };
    });
}

/**
 * Group characters by identical damage zones so that a long list of classes
 * sharing the same values collapses into a single row.
 */
export function characterZoneRows(characters) {
    const groups = new Map();
    for (const character of characters) {
        const zones = character.damage_zones || {};
        const key = JSON.stringify(Object.entries(zones).sort());
        if (!groups.has(key)) groups.set(key, { zones, members: [] });
        groups.get(key).members.push(character);
    }

    return [...groups.values()].map(({ zones, members }) => {
        const row = {
            id: members[0].id,
            name: members.length === characters.length
                ? `All classes (${members.length})`
                : members.map((m) => m.name).join(', '),
            source: members.map((m) => m.id).join(', '),
        };
        for (const [limb, keys] of Object.entries(LIMBS)) {
            row[limb] = zoneValue(zones, keys) ?? 1;
        }
        return row;
    });
}

/** Format incoming damage multiplier: red when the victim takes more damage */
export function ZoneModifier(key) {
    return function format(row) {
        const value = row[key];
        if (typeof value !== 'number') return null;
        const title = `${row.source || row.id}: x${value}`;
        if (value === 1) {
            return <span title={title}>±0%</span>;
        }
        const style = { fontWeight: 'bold', color: value > 1 ? '#f0001f' : '#218409' };
        const percent = Math.round(Math.abs(value - 1) * 100);
        return <span style={style} title={title}>{value > 1 ? '+' : '-'}{percent}%</span>;
    };
}

/**
 * Format weapon headshot multiplier. Weapons without a head bonus stay empty.
 * When the secondary attack (throw) differs from the primary (melee), both are
 * shown as "melee / throw", with "—" marking the attack without a bonus.
 */
export function fmtHeadshot(key, secondaryKey = null) {
    const hasBonus = (v) => v != null && v !== 1;
    const label = (v) => (hasBonus(v) ? `+${Math.round((v - 1) * 100)}%` : '—');
    return function format(row) {
        const value = row[key];
        const secondary = secondaryKey ? row[secondaryKey] : null;
        const split = secondary != null && value != null && secondary !== value;
        if (!hasBonus(value) && !(split && hasBonus(secondary))) return null;
        const title = [value, split ? secondary : null].filter((v) => v != null).map((v) => `x${v}`).join(' / ');
        return (
            <span title={`headshot damage: ${title}`}>
                <strong>{label(value)}</strong>
                {split && (
                    <small style={{ color: 'var(--ifm-color-secondary-darkest)' }}> / {label(secondary)}</small>
                )}
            </span>
        );
    };
}
