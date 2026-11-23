import data from '/static/data.json';

export const MAX_ITEMS = 3;

const isFireteamSecondary = (w) =>
    ['Weapon.Category.Pistol', 'Weapon.Category.SMG', 'Weapon.Category.SecondarySpecial'].includes(w.category)
    || w.id.endsWith('_Secondary');

/**
 * Per side: weapons never rolled (always carried, or equipped as gear) and which
 * weapons fit each slot.
 */
export const SIDES = {
    predator: {
        excluded: ['WD_Predator_WristBlades', 'WD_Predator_PlasmaCaster', 'WD_Predator_WristDart_CityHunter'],
        primary: () => true,
        secondary: () => true,
    },
    fireteam: {
        excluded: ['Default__WD_Knife_Gear_Base_C', 'WD_Grenade_Frag_FT'],
        primary: (w) => !isFireteamSecondary(w),
        secondary: isFireteamSecondary,
    },
};

export function weaponPools(side) {
    const rules = SIDES[side];
    const pool = data.weapons[side].filter((w) => !rules.excluded.includes(w.id));
    return { primary: pool.filter(rules.primary), secondary: pool.filter(rules.secondary) };
}

/** Classes from the base game; everything shipped under DLC_Release counts as DLC. */
export function isBaseClass(character) {
    return !character.source.includes('/DLC_Release/');
}

/** Seeded PRNG (mulberry32) so a loadout can be rebuilt from its seed. */
export function rng(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function newSeed() {
    return Math.floor(Math.random() * 0x100000000);
}

function pick(list, rand) {
    return list[Math.floor(rand() * list.length)];
}

/**
 * Pick up to MAX_ITEMS distinct items whose summed `costKey` fits in `budget`.
 * With `maximise`, only the combinations using the most points are considered.
 */
export function pickItems(items, costKey, budget, rand, maximise) {
    const combos = [];
    const walk = (start, chosen, total) => {
        combos.push({ chosen, total });
        if (chosen.length === MAX_ITEMS) return;
        for (let i = start; i < items.length; i++) {
            const cost = items[i][costKey];
            if (total + cost <= budget) walk(i + 1, [...chosen, items[i]], total + cost);
        }
    };
    walk(0, [], 0);
    let pool = combos;
    if (maximise) {
        const best = Math.max(...combos.map((c) => c.total));
        pool = combos.filter((c) => c.total === best);
    }
    return pick(pool, rand);
}

/** Classes eligible for the roster settings. */
export function roster(side, includeDlc) {
    return data.characters[side].filter((c) => includeDlc || isBaseClass(c));
}

export function generateLoadout({ side, includeDlc, classId, maximise, seed }) {
    const rand = rng(seed);
    const characters = roster(side, includeDlc);
    const character = characters.find((c) => c.id === classId) ?? pick(characters, rand);
    const specs = data.specializations[side].filter((s) => s.classes.includes(character.id));
    const spec = specs.length ? pick(specs, rand) : null;
    const pools = weaponPools(side);
    const primary = pick(pools.primary, rand);
    const secondary = pick(pools.secondary.filter((w) => w.id !== primary.id), rand);
    const perks = pickItems(data.perks[side], 'points', character.max_perk, rand, maximise);
    const gear = pickItems(data.gear[side], 'weight', character.max_gear, rand, maximise);
    return { character, spec, primary, secondary, perks, gear, seed };
}

export function loadoutText(l) {
    const items = (list, key) => (list.length ? list.map((x) => `${x.name} (${x[key]})`).join(', ') : 'none');
    return [
        `${l.character.name}${l.spec ? ` · ${l.spec.name}` : ''}`,
        `Weapons: ${l.primary.name} / ${l.secondary.name}`,
        `Perks (${l.perks.total}/${l.character.max_perk}): ${items(l.perks.chosen, 'points')}`,
        `Gear (${l.gear.total}/${l.character.max_gear}): ${items(l.gear.chosen, 'weight')}`,
    ].join('\n');
}
