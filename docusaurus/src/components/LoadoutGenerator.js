import { useEffect, useState } from 'react';
import ItemIcon, { selectStyle } from '@site/src/components/ItemIcon';
import { generateLoadout, loadoutText, newSeed, roster, MAX_ITEMS } from '@site/src/components/loadoutGen';

const SMALL = { color: 'var(--ifm-color-secondary-darkest)' };
const RANDOM = '';

function Field({ label, children }) {
    return (
        <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{label}</div>
            {children}
        </div>
    );
}

function Item({ item, extra }) {
    return (
        <div title={item.description} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <ItemIcon icon={item.icon} />
            <span><strong>{item.name}</strong>{extra != null && <small style={SMALL}> · {extra}</small>}</span>
        </div>
    );
}

function Budget({ title, picked, budget, costKey }) {
    return (
        <Field label={<>{title} <small style={SMALL}>{picked.chosen.length}/{MAX_ITEMS} slots · {picked.total}/{budget} pts</small></>}>
            {picked.chosen.length === 0 && <small style={SMALL}>none</small>}
            {picked.chosen.map((x) => <Item key={x.id} item={x} extra={`${x[costKey]} pts`} />)}
        </Field>
    );
}

function readQuery() {
    const q = new URLSearchParams(window.location.search);
    const seed = parseInt(q.get('seed'), 10);
    return {
        seed: Number.isFinite(seed) ? seed >>> 0 : null,
        includeDlc: q.get('dlc') !== '0',
        maximise: q.get('max') === '1',
        classId: q.get('class') ?? RANDOM,
    };
}

function shareUrl(settings) {
    const q = new URLSearchParams({ seed: settings.seed, dlc: settings.includeDlc ? 1 : 0, max: settings.maximise ? 1 : 0 });
    if (settings.classId) q.set('class', settings.classId);
    return `${window.location.origin}${window.location.pathname}?${q}`;
}

/** Random loadout for `side` within the class's perk and gear budgets. */
export default function LoadoutGenerator({ side }) {
    const [includeDlc, setIncludeDlc] = useState(true);
    const [maximise, setMaximise] = useState(false);
    const [classId, setClassId] = useState(RANDOM);
    const [loadout, setLoadout] = useState(null);
    const [copied, setCopied] = useState('');

    // Roll on the client only: the first roll comes from the URL, if it has a seed
    useEffect(() => {
        const q = readQuery();
        setIncludeDlc(q.includeDlc);
        setMaximise(q.maximise);
        setClassId(q.classId);
        setLoadout(generateLoadout({ ...q, side, seed: q.seed ?? newSeed() }));
    }, [side]);

    const classes = roster(side, includeDlc);
    const settings = { side, includeDlc, maximise, classId };

    function generate() {
        setLoadout(generateLoadout({ ...settings, seed: newSeed() }));
        setCopied('');
    }

    function changeDlc(value) {
        setIncludeDlc(value);
        if (!value && classId && !roster(side, false).some((c) => c.id === classId)) setClassId(RANDOM);
    }

    async function copy(kind) {
        const text = kind === 'link' ? shareUrl({ ...settings, seed: loadout.seed }) : loadoutText(loadout);
        try {
            await navigator.clipboard.writeText(text);
            setCopied(kind);
        } catch {
            setCopied('failed');
        }
    }

    return (
        <div className="row" style={{ marginBottom: '2rem' }}>
            <div className="col col--4" style={{ marginBottom: '1rem' }}>
                <div className="card shadow--md">
                    <div className="card__header"><h3>Settings</h3></div>
                    <div className="card__body">
                        <Field label="Roster">
                            <label style={{ display: 'flex', gap: 8, cursor: 'pointer' }}>
                                <input type="checkbox" checked={includeDlc} onChange={(e) => changeDlc(e.target.checked)} />
                                Include DLC classes
                            </label>
                        </Field>
                        <Field label="Class">
                            <select style={selectStyle} value={classId} onChange={(e) => setClassId(e.target.value)}>
                                <option value={RANDOM}>🎲 Random ({classes.length})</option>
                                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </Field>
                        <Field label="Points">
                            <label style={{ display: 'flex', gap: 8, cursor: 'pointer' }}>
                                <input type="checkbox" checked={maximise} onChange={(e) => setMaximise(e.target.checked)} />
                                Maximise perk and gear points
                            </label>
                        </Field>
                        <button className="button button--primary button--block" onClick={generate}>🎲 Generate loadout</button>
                    </div>
                </div>
            </div>
            <div className="col col--8">
                <div className="card shadow--md">
                    {!loadout ? <div className="card__body">Rolling…</div> : (
                        <>
                            <div className="card__header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <ItemIcon icon={loadout.character.icon} size={48} />
                                <div>
                                    <h3 style={{ margin: 0 }}>{loadout.character.name}</h3>
                                    <span title={loadout.spec?.description}>{loadout.spec ? loadout.spec.name : <small style={SMALL}>no specialization</small>}</span>
                                </div>
                            </div>
                            <div className="card__body">
                                <div className="row">
                                    <div className="col col--4">
                                        <Field label="Weapons">
                                            <Item item={loadout.primary} extra="primary" />
                                            <Item item={loadout.secondary} extra="secondary" />
                                        </Field>
                                    </div>
                                    <div className="col col--4">
                                        <Budget title="Perks" picked={loadout.perks} budget={loadout.character.max_perk} costKey="points" />
                                    </div>
                                    <div className="col col--4">
                                        <Budget title="Gear" picked={loadout.gear} budget={loadout.character.max_gear} costKey="weight" />
                                    </div>
                                </div>
                            </div>
                            <div className="card__footer" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <button className="button button--secondary button--sm" onClick={() => copy('text')}>📋 Copy loadout</button>
                                <button className="button button--secondary button--sm" onClick={() => copy('link')}>🔗 Copy link</button>
                                <small style={SMALL}>
                                    {copied === 'text' && 'Loadout copied.'}
                                    {copied === 'link' && 'Link copied; it opens this exact loadout.'}
                                    {copied === 'failed' && 'Copy failed: clipboard not available.'}
                                </small>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
