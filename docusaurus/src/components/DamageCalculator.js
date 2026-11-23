import { useMemo, useState } from 'react';
import Table from '@site/src/components/Table';
import Icon from '@site/src/components/Icon';
import PerkIcon, { selectStyle } from '@site/src/components/ItemIcon';
import data from '/static/data.json';
import {
    ATTACKER_MODIFIERS, TARGET_MODIFIERS, TARGET_HEALTH_PERKS, OPPONENT, ZONES,
    calculatorRows, modifierValue,
} from '@site/src/components/damageCalc';

const SMALL = { color: 'var(--ifm-color-secondary-darkest)' };
const NO_TARGET = '';

const fmt = (v, digits = 1) => (v == null ? null : (+v.toFixed(digits)).toLocaleString('en'));

function percent(value) {
    const p = Math.round((value - 1) * 100);
    return `${p > 0 ? '+' : ''}${p}%`;
}

function modifierColor(value, incoming) {
    if (value === 1) return undefined;
    // For the attacker more damage is good, for the target less damage is good
    return (value > 1) !== incoming ? '#218409' : '#f0001f';
}

/** Short description of what a perk/specialization does to damage */
function effectLabel(item, def) {
    const value = modifierValue(item, def);
    if (value == null) return null;
    return [percent(value), def.scope ? `${def.scope} damage` : 'damage', def.when ? `(${def.when})` : null]
        .filter(Boolean).join(' ');
}

function PerkList({ perks, selected, onToggle, defs, incoming, extra }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {perks.map((perk) => {
                const def = defs[perk.id];
                const value = modifierValue(perk, def);
                return (
                    <label key={perk.id} title={perk.description} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input type="checkbox" checked={selected.includes(perk.id)} onChange={() => onToggle(perk.id)} />
                        <PerkIcon icon={perk.icon} />
                        <span>
                            <strong>{perk.name}</strong>
                            {perk.points != null && <small style={SMALL}> · {perk.points} pts</small>}
                            <br />
                            <small style={{ color: def ? modifierColor(value, incoming) : undefined }}>
                                {def ? effectLabel(perk, def) : extra?.(perk)}
                            </small>
                        </span>
                    </label>
                );
            })}
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{label}</div>
            {children}
        </div>
    );
}

function toggle(list, id) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function fmtDamage(row) {
    const breakdown = [`base ${fmt(row.base, 2)}`, ...row.parts.map(([label, v]) => `× ${v} ${label}`), `= ${fmt(row.damage, 2)}`].join('\n');
    const combo = row.hits.length > 1;
    return (
        <span title={breakdown}>
            {combo && <small style={SMALL}>{row.hits.map((h) => fmt(h)).join(' / ')} = </small>}
            <strong>{fmt(row.damage)}</strong>
            {row.multiplier !== 1 && (
                <small style={{ color: row.multiplier > 1 ? '#218409' : '#f0001f' }}> {percent(row.multiplier)}</small>
            )}
        </span>
    );
}

function fmtBase(row) {
    return <span title={row.baseHits.join(' / ')}>{fmt(row.base)}</span>;
}

function fmtAttack(row) {
    const tip = [row.damageClass, ...row.notes].filter(Boolean).join('\n');
    return (
        <span title={tip}>
            {row.attack}
            {row.notes.length > 0 && <small style={SMALL}> ⓘ</small>}
        </span>
    );
}

function fmtDps(row) {
    if (row.dps == null) return null;
    return <span title={`${fmt(row.hits[0], 2)} × ${row.fireRate} rpm ÷ 60`}><strong>{fmt(row.dps, 0)}</strong></span>;
}

function fmtHits(row) {
    if (row.hitsToKill == null) return null;
    const reload = row.fireRate != null && row.magSize != null && row.hitsToKill > row.magSize;
    return (
        <span title={reload ? `needs more than one magazine (${row.magSize})` : undefined}>
            <strong>{row.hitsToKill}</strong>{reload && <small style={SMALL}> ↻</small>}
        </span>
    );
}

function fmtTtk(row) {
    if (row.timeToKill == null) return null;
    return <span title="time from the first to the last hit, no reloads or misses">{fmt(row.timeToKill, 2)} <small>s</small></span>;
}

function fmtMag(row) {
    if (row.magDamage == null) return null;
    return <span title={`${row.magSize} × ${fmt(row.hits[0], 2)}`}>{fmt(row.magDamage, 0)}</span>;
}

/**
 * Damage calculator: pick a class, specialization and perks of `side`, a target of the
 * opposing side, and see damage, DPS and hits to down for every weapon.
 */
export default function DamageCalculator({ side }) {
    const targetSide = OPPONENT[side];
    const characters = data.characters[side];
    const targets = data.characters[targetSide];
    const weapons = data.weapons[side];
    const attackerDefs = ATTACKER_MODIFIERS[side];
    const targetDefs = TARGET_MODIFIERS[targetSide];

    const [characterId, setCharacterId] = useState(characters[0].id);
    const [specId, setSpecId] = useState('');
    const [perkIds, setPerkIds] = useState([]);
    const [targetId, setTargetId] = useState(targets[0].id);
    const [zone, setZone] = useState('body');
    const [range, setRange] = useState(10);
    const [targetPerkIds, setTargetPerkIds] = useState([]);

    const character = characters.find((c) => c.id === characterId);
    const target = targets.find((c) => c.id === targetId) ?? null;

    const specs = data.specializations[side].filter((s) => s.classes.includes(characterId));
    const spec = specs.find((s) => s.id === specId) ?? null;
    const damagePerks = data.perks[side].filter((p) => attackerDefs[p.id]);
    const perks = damagePerks.filter((p) => perkIds.includes(p.id));
    const points = perks.reduce((sum, p) => sum + (p.points ?? 0), 0);

    const targetPerkPool = [
        ...data.perks[targetSide],
        ...(targetSide === 'fireteam' ? data.perks.last_man_standing : []),
    ].filter((p) => targetDefs[p.id] || TARGET_HEALTH_PERKS[targetSide].includes(p.id));
    const targetPerks = targetPerkPool.filter((p) => targetPerkIds.includes(p.id));
    const bonusHealth = targetPerks
        .filter((p) => TARGET_HEALTH_PERKS[targetSide].includes(p.id))
        .reduce((sum, p) => sum + (p.modifier ?? 0), 0);
    const health = target ? target.health + bonusHealth : null;

    const zones = targetSide === 'predator' ? ['head', 'body', 'arms', 'legs'] : ['head', 'body'];

    function changeCharacter(id) {
        setCharacterId(id);
        // Keep the specialization only when the new class can use it too
        const keep = data.specializations[side].some((s) => s.id === specId && s.classes.includes(id));
        if (!keep) setSpecId('');
    }

    const rows = useMemo(() => calculatorRows(weapons, {
        character,
        side,
        modifiers: [...perks, ...(spec && attackerDefs[spec.id] ? [spec] : [])],
        target,
        targetSide,
        targetModifiers: targetPerks.filter((p) => targetDefs[p.id]),
        zone,
        range: side === 'fireteam' ? range : 0,
        health,
    }), [characterId, specId, perkIds.join(), targetId, targetPerkIds.join(), zone, range, side]);

    const ranged = side === 'fireteam';
    const columns = [
        { name: 'Weapon', key: 'name', format: Icon('name') },
        { name: 'Attack', key: 'attack', format: fmtAttack },
        { name: 'Base', key: 'base', align: 'right', numeric: true, format: fmtBase, detail: true },
        { name: 'Damage', key: 'damage', align: 'right', numeric: true, format: fmtDamage },
        ...(ranged ? [{ name: 'DPS', key: 'dps', align: 'right', numeric: true, format: fmtDps }] : []),
        ...(target ? [{ name: 'Hits to down', key: 'hitsToKill', align: 'right', numeric: true, format: fmtHits }] : []),
        ...(ranged && target ? [{ name: 'Time to down', key: 'timeToKill', align: 'right', numeric: true, format: fmtTtk }] : []),
        ...(ranged ? [
            { name: 'Fire rate', key: 'fireRate', align: 'right', numeric: true, detail: true, format: (r) => r.fireRate && <span>{r.fireRate} <small>rpm</small></span> },
            { name: 'Per magazine', key: 'magDamage', align: 'right', numeric: true, detail: true, format: fmtMag },
        ] : []),
    ];

    const specDef = spec ? attackerDefs[spec.id] : null;

    return (
        <div>
            <div className="row" style={{ marginBottom: '1rem' }}>
                <div className="col col--6" style={{ marginBottom: '1rem' }}>
                    <div className="card shadow--md" style={{ height: '100%' }}>
                        <div className="card__header"><h3>{side === 'predator' ? '👽 Predator' : '🪖 Fireteam'}</h3></div>
                        <div className="card__body">
                            <Field label="Class">
                                <select style={selectStyle} value={characterId} onChange={(e) => changeCharacter(e.target.value)}>
                                    {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                {character.melee_modifier != null && character.melee_modifier !== 1 && (
                                    <small style={{ color: modifierColor(character.melee_modifier, false) }}>
                                        {percent(character.melee_modifier)} melee damage
                                    </small>
                                )}
                            </Field>
                            <Field label="Specialization">
                                <select style={selectStyle} value={specId} onChange={(e) => setSpecId(e.target.value)}>
                                    <option value="">None</option>
                                    {specs.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}{attackerDefs[s.id] ? '' : ' (no damage effect)'}</option>
                                    ))}
                                </select>
                                {spec && (
                                    <small style={{ color: specDef ? modifierColor(modifierValue(spec, specDef), false) : SMALL.color }} title={spec.description}>
                                        {specDef ? effectLabel(spec, specDef) : spec.description}
                                    </small>
                                )}
                            </Field>
                            <Field label={<>Perks <small style={{ ...SMALL, fontWeight: 'normal' }}>
                                (damage perks only · {points} / {character.max_perk} points
                                {points > character.max_perk && <span style={{ color: '#f0001f' }}> — over the limit</span>})
                            </small></>}>
                                <PerkList perks={damagePerks} selected={perkIds} defs={attackerDefs}
                                    onToggle={(id) => setPerkIds(toggle(perkIds, id))} incoming={false} />
                            </Field>
                        </div>
                    </div>
                </div>
                <div className="col col--6" style={{ marginBottom: '1rem' }}>
                    <div className="card shadow--md" style={{ height: '100%' }}>
                        <div className="card__header"><h3>🎯 Target</h3></div>
                        <div className="card__body">
                            <Field label="Class">
                                <select style={selectStyle} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                                    <option value={NO_TARGET}>No target (raw damage)</option>
                                    {targets.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                {target && (
                                    <small style={SMALL}>
                                        {fmt(health, 0)} health{bonusHealth ? ` (incl. +${bonusHealth})` : ''}
                                        {targetSide === 'predator' ? ' until Second Wind' : ' until downed'}
                                    </small>
                                )}
                            </Field>
                            <Field label="Hit zone">
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    {zones.map((z) => (
                                        <label key={z} style={{ cursor: 'pointer' }}>
                                            <input type="radio" name={`zone-${side}`} checked={zone === z} onChange={() => setZone(z)} /> {ZONES[z].label}
                                        </label>
                                    ))}
                                </div>
                            </Field>
                            {ranged && (
                                <Field label={`Distance: ${range} m`}>
                                    <input type="range" min="0" max="150" step="1" value={range}
                                        onChange={(e) => setRange(+e.target.value)} style={{ width: '100%' }} />
                                </Field>
                            )}
                            {target && (
                                <Field label={<>Target perks <small style={{ ...SMALL, fontWeight: 'normal' }}>(defensive only)</small></>}>
                                    <PerkList perks={targetPerkPool} selected={targetPerkIds} defs={targetDefs}
                                        onToggle={(id) => setTargetPerkIds(toggle(targetPerkIds, id))} incoming
                                        extra={(p) => `+${p.modifier} health`} />
                                </Field>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <Table columns={columns} data={rows} fullWidth key={columns.map((c) => c.key).join()} />
        </div>
    );
}
