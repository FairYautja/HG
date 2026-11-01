// Helpers for damage type based character stats (armor, self armor).

import data from '/static/data.json';
import { ZoneModifier } from '@site/src/components/BodyParts';

function flattenAttacks(attacks, out = []) {
    if (Array.isArray(attacks)) {
        attacks.forEach((a) => flattenAttacks(a, out));
    } else if (attacks && typeof attacks === 'object') {
        out.push(attacks);
    }
    return out;
}

/** Map of damage type class -> sorted weapon names using it (both factions, weapons and gear) */
export const damageTypeUsers = (() => {
    const users = new Map();
    const all = [
        ...data.weapons.fireteam, ...data.weapons.predator,
        ...data.gear.fireteam, ...data.gear.predator,
    ];
    for (const weapon of all) {
        for (const attack of flattenAttacks(weapon.attacks)) {
            if (!attack.damage_class) continue;
            if (!users.has(attack.damage_class)) users.set(attack.damage_class, new Set());
            users.get(attack.damage_class).add(weapon.name);
        }
    }
    return new Map([...users].map(([k, v]) => [k, [...v].sort().join(', ')]));
})();

// Player facing names for internal damage type classes
export const DAMAGE_TYPE_NAMES = {
    Bullet_SmallCaliber: 'Bullets',
    Bullet_HighCaliber: 'Sniper bullets',
    Bullet_Shotgun: 'Shotgun pellets',
    Bullet_MiniGun: 'Minigun bullets',
    Bullet_SmallCaliber_NPC: 'NPC bullets',
    Bullet_HighCaliber_NPC: 'NPC sniper bullets',
    Bullet_Shotgun_NPC: 'NPC shotgun pellets',
    FT_Explosive: 'Frag grenade',
    FT_LauncherExplosive: 'Grenade launcher',
    FT_RocketExplosive: 'Rocket launcher',
    FT_Slashing: 'Knife',
    FT_SmallPlasma: 'Fireteam small plasma',
    Explosive: 'Explosion',
    Plasma: 'Plasma',
    SmallPlasma: 'Small plasma',
    Slashing: 'Blades',
    Slashing_WristBlades: 'Wrist Blades',
    Slashing_Katana: 'Katana',
    Slashing_BattleAxe: 'Battle Axe',
    Bludgeon: 'Blunt weapons',
    Arrow: 'Arrows',
    CombiStick: 'Combistick throw',
    CombiStickMelee: 'Combistick melee',
    SmartDisc: 'Smart Disc',
    WristDart: 'Wrist Launcher',
    PounceSlam: 'Pounce slam',
    DT_Kunai: 'Kunai',
};

/** Readable damage type name, falls back to the class name: 'Foo_Bar_NPC' -> 'Foo Bar (NPC)' */
export function damageTypeName(id) {
    if (DAMAGE_TYPE_NAMES[id]) return DAMAGE_TYPE_NAMES[id];
    const npc = id.endsWith('_NPC');
    const name = id.replace(/_NPC$/, '').replaceAll('_', ' ');
    return npc ? `${name} (NPC)` : name;
}

/** Damage type name with the internal class name as tooltip (for table headers and cells) */
export function DamageTypeLabel({ id }) {
    return <span title={id}>{damageTypeName(id)}</span>;
}

/** Table cell formatter for rows from damageTypeRows() */
export function fmtDamageTypeName(row) {
    if (row.unit !== undefined) return row.name;
    return <DamageTypeLabel id={row.source} />;
}

/** Value shared by all rows, or undefined when rows differ */
export function commonValue(rows, key) {
    const values = rows.map((r) => JSON.stringify(r[key] ?? null));
    return values.every((v) => v === values[0]) ? rows[0][key] : undefined;
}

/** Entries of a {damage_type: multiplier} field that are identical for every row */
export function commonModifiers(rows, key) {
    const first = rows[0]?.[key] || {};
    const common = {};
    for (const [k, v] of Object.entries(first)) {
        if (rows.every((r) => r[key]?.[k] === v)) common[k] = v;
    }
    return common;
}

/** Rows for a {damage_type: multiplier} dict, sorted from strongest reduction */
export function damageTypeRows(modifiers, category) {
    return Object.entries(modifiers || {})
        .map(([id, value]) => ({
            id: `${category}:${id}`,
            source: id,
            category,
            name: damageTypeName(id),
            value,
            used_by: id.endsWith('_NPC') ? 'NPC enemies' : (damageTypeUsers.get(id) ?? ''),
        }))
        .sort((a, b) => a.value - b.value || a.name.localeCompare(b.name));
}

const modifierFormat = ZoneModifier('value');

/** Format either a damage multiplier (armor rows) or a plain value with its unit */
export function fmtCommonValue(row) {
    if (row.unit !== undefined) {
        return <strong title={row.source}>{row.value}{row.unit}</strong>;
    }
    return modifierFormat(row);
}
