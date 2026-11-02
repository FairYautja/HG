// Damage calculator math, kept free of React and of the data import so it can be
// reused and tested on its own.
//
// Damage of one hit:
//   base × class melee modifier (melee only) × attacker perks × attacker specialization
//        × target armor[damage class] × body part (+ weapon headshot bonus) × target perks
//
// All modifiers multiply. Armor multiplies incoming damage (verified in game). Body part
// modifiers are not applied to explosions/splash, which is still unverified in game.

export const OPPONENT = { fireteam: 'predator', predator: 'fireteam' };

const MELEE_TYPES = new Set(['melee_single', 'melee_combo', 'melee_weapon']);
const isAll = () => true;
const isMelee = (a) => a.melee;
const isRanged = (a) => !a.melee;

/**
 * Damage modifiers of perks and specializations. Values come from data.json; `value`
 * picks the field, `applies` limits them to some attacks and `when` is the in-game
 * condition the calculator assumes to be met.
 */
export const ATTACKER_MODIFIERS = {
    fireteam: {
        PK_FT_PredDamage:  { applies: isAll },
        PK_FT_MeleeDamage: { applies: isMelee, scope: 'melee' },
        Spec_Deadly:    { applies: (a, w) => w.category === 'Weapon.Category.AssaultRifle', scope: 'assault rifles' },
        Spec_Overwatch: { applies: isAll, when: 'firing from a height advantage' },
        Spec_Unleashed: { applies: (a) => a.explosive, scope: 'explosives' },
        Spec_Sniper:    { applies: isAll, when: 'target is spotted' },
        Spec_Reckless:  { applies: isAll, when: 'for 3 s after taking damage' },
        Spec_Fanatic:   { applies: isAll, when: 'below 50% health' },
        Spec_Duelist:   { applies: (a, w) => w.category === 'Weapon.Category.Pistol', scope: 'pistols' },
        Spec_Liberator: { applies: isAll, value: 'secondary_modifier', when: 'for 7 s after disabling a camp alarm' },
    },
    predator: {
        PK_P_IncreasedRangedDmg: { applies: isRanged, scope: 'ranged' },
        PK_P_MeleeDamage:        { applies: isMelee, scope: 'melee' },
        Spec_Analytic:  { applies: isAll, when: 'target is fully scanned' },
        Spec_Wrathful:  { applies: isMelee, scope: 'melee', when: 'next melee after being hit from behind' },
        Spec_Fervent:   { applies: isAll, when: 'whole Fireteam alive and standing' },
        Spec_Assassin:  { applies: isAll, when: 'attacking from behind' },
        Spec_Ghost:     { applies: isMelee, scope: 'melee', when: 'from cloak, up to 3 s after decloaking' },
        Spec_Tactician: { applies: isAll, when: 'target trapped, netted or interacting' },
        Spec_Stalker:   { applies: isAll, when: 'at full stamina' },
    },
};

/** Defensive perks of the target, keyed by the target's side */
export const TARGET_MODIFIERS = {
    predator: {
        PK_P_IncreasedBulletResist: { applies: (a) => a.damageType === 'Bullet', scope: 'bullets' },
        PK_P_ReducedPredkourDamage: { applies: isAll, when: 'in the trees' },
        PK_P_BackShotDamage:        { applies: isAll, when: 'hit from behind while moving, healing, claiming or stealth killing' },
    },
    fireteam: {
        PK_FT_ReducedPredDamage:    { applies: isAll },
        PK_FT_LMS_DamageResistance: { applies: isAll, when: 'Last Man Standing' },
    },
};

/** Target perks that add health instead of reducing damage */
export const TARGET_HEALTH_PERKS = { fireteam: ['PK_FT_IncreasedHealth'], predator: [] };

export const ZONES = {
    head: { label: 'Head', keys: ['Head'] },
    body: { label: 'Body', keys: ['Body'] },
    arms: { label: 'Arms', keys: ['LeftArm', 'RightArm'] },
    legs: { label: 'Legs', keys: ['LeftLeg', 'RightLeg'] },
};

export function modifierValue(item, def) {
    const v = item[def?.value ?? (item.modifier !== undefined ? 'modifier' : 'main_modifier')];
    return typeof v === 'number' ? v : null;
}

/** Piecewise linear damage falloff (Unreal curve); distance in cm, clamped at both ends */
export function damageAt(damage, distance, cm) {
    if (!Array.isArray(damage)) return damage;
    if (!Array.isArray(distance) || damage.length === 1) return damage[0];
    if (cm <= distance[0]) return damage[0];
    for (let i = 1; i < distance.length; i++) {
        if (cm <= distance[i]) {
            const t = (cm - distance[i - 1]) / (distance[i] - distance[i - 1]);
            return damage[i - 1] + t * (damage[i] - damage[i - 1]);
        }
    }
    return damage[damage.length - 1];
}

function category(attack) {
    return attack.damage_type?.replace('ESFDamageTypeCategory::', '') ?? null;
}

/**
 * Normalise a weapon's attacks into calculator rows. Each row has `hits` (damage of
 * each hit in the sequence, before modifiers), whether it is melee or explosive,
 * the damage class used for armor and the weapon headshot bonus.
 */
export function weaponAttacks(weapon, rangeCm = 0) {
    const raw = weapon.attacks;
    if (!raw || (!Array.isArray(raw) && Object.keys(raw).length === 0)) return [];
    const modes = Array.isArray(raw) ? raw : [raw];
    const hasProjectile = modes.some((m) => !Array.isArray(m) && m?.type === 'projectile');
    const rows = [];

    const base = (a, extra) => ({
        weapon,
        damageClass: a.damage_class,
        damageType: category(a),
        headshot: a.zones?.Head ?? a.headshot ?? 1,
        melee: MELEE_TYPES.has(a.type),
        explosive: category(a) === 'Explosion',
        fireRate: a.fire_rate ?? null,
        pellets: a.pellets ?? 1,
        noZones: false,
        notes: [],
        ...extra,
    });

    modes.forEach((mode, modeIndex) => {
        const attacks = Array.isArray(mode) ? mode : [mode];
        for (const a of attacks) {
            if (!a || !a.type) continue;
            switch (a.type) {
                case 'melee_single':
                    rows.push(base(a, { attack: modeIndex === 0 ? 'Light' : 'Heavy', hits: [a.damage[0]] }));
                    break;
                case 'melee_weapon':
                    rows.push(base(a, { attack: 'Quick melee', hits: [a.damage[0]] }));
                    break;
                case 'melee_combo':
                    rows.push(base(a, {
                        attack: `Combo (${a.damage.length} hits)`,
                        hits: a.damage,
                        notes: [a.impact_radius ? `last hit stuns within ${a.impact_radius / 100} m` : null],
                    }));
                    break;
                case 'projectile': {
                    const dmg = damageAt(a.damage, a.distance, rangeCm);
                    rows.push(base(a, {
                        attack: a.pellets ? `Shot (${a.pellets} pellets)` : 'Shot',
                        hits: [dmg * (a.pellets ?? 1)],
                        notes: [a.pellets ? `${+dmg.toFixed(1)} per pellet, all pellets hit` : null],
                    }));
                    break;
                }
                case 'grenade':
                    rows.push(base(a, {
                        attack: hasProjectile ? 'Underbarrel grenade' : 'Grenade',
                        hits: [(a.direct_hit_damage ?? 0) + (a.splash_damage_max ?? 0)],
                        noZones: true,
                        notes: [`direct hit ${a.direct_hit_damage ?? 0} + splash ${a.splash_damage_max} (falls to ${a.splash_damage_min} at ${a.splash_radius_outer / 100} m)`],
                    }));
                    break;
                case 'throw':
                    rows.push(base(a, {
                        attack: 'Throw',
                        hits: [a.damage],
                        notes: [a.damage_back != null ? `return hit ${a.damage_back}` : null],
                    }));
                    break;
                case 'fire': {
                    const charged = Array.isArray(a.damage);
                    rows.push(base(a, {
                        attack: charged ? 'Shot (full charge)' : 'Shot',
                        hits: [charged ? a.damage[a.damage.length - 1] : a.damage],
                        notes: [
                            charged ? 'charge ' + a.damage.map((d, i) => `${a.damage_time?.[i]} s: ${d}`).join(', ') : null,
                            a.damage_fire ? `+ burns ${a.damage_fire}/s for ${a.fire_time} s` : null,
                        ],
                    }));
                    if (a.splash_damage_max != null) {
                        rows.push(base(a, {
                            attack: 'Splash',
                            hits: [a.splash_damage_max],
                            noZones: true,
                            notes: [`falls to ${a.splash_damage_min} at ${a.splash_radius_outer / 100} m`],
                        }));
                    }
                    break;
                }
                default:
                    break;
            }
        }
    });
    return rows.map((r) => ({ ...r, notes: r.notes.filter(Boolean) }));
}

/**
 * Multiplier of one attack and its breakdown (list of [label, value]) for the
 * chosen build and target.
 */
export function attackMultiplier(attack, ctx) {
    const parts = [];
    const { character, side, modifiers, target, targetSide, targetModifiers, zone } = ctx;

    if (attack.melee && character?.melee_modifier != null && character.melee_modifier !== 1) {
        parts.push([`${character.name} melee`, character.melee_modifier]);
    }
    for (const item of modifiers) {
        const def = ATTACKER_MODIFIERS[side][item.id];
        const value = modifierValue(item, def);
        if (def && value != null && def.applies(attack, attack.weapon)) parts.push([item.name, value]);
    }
    if (target) {
        const armor = target.armor?.[attack.damageClass];
        if (armor != null && armor !== 1) parts.push([`armor (${attack.damageClass})`, armor]);
        if (!attack.noZones) {
            const z = ZONES[zone];
            const zoneMods = z.keys.map((k) => target.damage_zones?.[k]).filter((v) => v != null);
            if (zoneMods.length && Math.max(...zoneMods) !== 1) parts.push([`${z.label.toLowerCase()} zone`, Math.max(...zoneMods)]);
        }
        for (const item of targetModifiers) {
            const def = TARGET_MODIFIERS[targetSide][item.id];
            const value = modifierValue(item, def);
            if (def && value != null && def.applies(attack, attack.weapon)) parts.push([item.name, value]);
        }
    }
    if (zone === 'head' && !attack.noZones && attack.headshot !== 1) {
        parts.push(['weapon headshot', attack.headshot]);
    }
    return { value: parts.reduce((acc, [, v]) => acc * v, 1), parts };
}

/** Number of hits to deal `health` damage, cycling through a combo sequence */
export function hitsToKill(hits, health) {
    if (!health || !hits.length || hits.every((h) => h <= 0)) return null;
    let left = health;
    let count = 0;
    while (left > 1e-6 && count < 10000) {
        left -= hits[count % hits.length];
        count++;
    }
    return count;
}

/** Calculator table rows for every weapon of the attacking side */
export function calculatorRows(weapons, ctx) {
    const rangeCm = (ctx.range ?? 0) * 100;
    const rows = [];
    for (const weapon of weapons) {
        for (const attack of weaponAttacks(weapon, rangeCm)) {
            const { value, parts } = attackMultiplier(attack, ctx);
            const hits = attack.hits.map((h) => h * value);
            const total = hits.reduce((a, b) => a + b, 0);
            const perSecond = attack.fireRate ? attack.fireRate / 60 : null;
            const toKill = hitsToKill(hits, ctx.health);
            // Underbarrel grenades and splash don't use the weapon's magazine
            const ownMagazine = !attack.melee && attack.attack !== 'Underbarrel grenade' && attack.attack !== 'Splash';
            const magSize = ownMagazine ? weapon.magazine?.size ?? null : null;
            rows.push({
                id: `${weapon.id}:${attack.attack}`,
                name: weapon.name,
                icon: weapon.icon,
                source: weapon.id,
                attack: attack.attack,
                damageClass: attack.damageClass,
                notes: attack.notes,
                melee: attack.melee,
                baseHits: attack.hits,
                base: attack.hits.reduce((a, b) => a + b, 0),
                hits,
                damage: total,
                multiplier: value,
                parts,
                dps: perSecond ? hits[0] * perSecond : null,
                fireRate: attack.fireRate,
                hitsToKill: toKill,
                timeToKill: toKill != null && perSecond ? (toKill - 1) / perSecond : null,
                magSize,
                magDamage: magSize ? hits[0] * magSize : null,
            });
        }
    }
    return rows;
}
