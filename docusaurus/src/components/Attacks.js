// Renders the nested "attacks" structure from weapons data.
//
// attacks is either:
//   - an object (single attack mode, e.g. plasma caster fire)
//   - an array of attack modes, where each mode is either:
//       - an object (single attack, e.g. throw)
//       - an array of attacks (e.g. [melee_single, melee_combo])

const TYPE_LABEL = {
    melee_single: 'Single',
    melee_combo:  'Combo',
    fire:         'Fire',
    throw:        'Throw',
};

const DAMAGE_TYPE_LABEL = {
    'ESFDamageTypeCategory::Blade':  'Blade',
    'ESFDamageTypeCategory::Blunt':  'Blunt',
    'ESFDamageTypeCategory::Bullet': 'Bullet',
    'ESFDamageTypeCategory::Energy': 'Energy',
};

function fmtDamage(damage) {
    if (Array.isArray(damage)) return damage.join(' / ');
    return damage;
}

function AttackRow({ attack }) {
    const label = TYPE_LABEL[attack.type] ?? attack.type;
    const dmgType = DAMAGE_TYPE_LABEL[attack.damage_type] ?? attack.damage_type;

    const rows = [];

    if (attack.damage != null) {
        rows.push(
            <tr key="dmg">
                <td>{label}</td>
                <td>{dmgType}</td>
                <td style={{textAlign: 'right', fontWeight: 'bold'}}>{fmtDamage(attack.damage)}</td>
                <td></td>
            </tr>
        );
    }
    if (attack.damage_back != null) {
        rows.push(
            <tr key="dmg_back">
                <td></td>
                <td>Back hit</td>
                <td style={{textAlign: 'right'}}>{attack.damage_back}</td>
                <td></td>
            </tr>
        );
    }
    if (attack.splash_damage_max != null) {
        rows.push(
            <tr key="splash">
                <td></td>
                <td>Splash</td>
                <td style={{textAlign: 'right'}}>{attack.splash_damage_min}–{attack.splash_damage_max}</td>
                <td style={{textAlign: 'right'}}>{attack.splash_radius_inner}–{attack.splash_radius_outer} cm</td>
            </tr>
        );
    }
    if (attack.damage_fire != null) {
        rows.push(
            <tr key="fire">
                <td></td>
                <td>Fire DoT</td>
                <td style={{textAlign: 'right'}}>{attack.damage_fire}/s</td>
                <td style={{textAlign: 'right'}}>{attack.fire_time}s</td>
            </tr>
        );
    }
    if (attack.health != null) {
        rows.push(
            <tr key="health">
                <td></td>
                <td>Projectile HP</td>
                <td style={{textAlign: 'right'}}>{attack.health}</td>
                <td></td>
            </tr>
        );
    }

    return rows;
}

function AttackMode({ mode }) {
    // mode is either a single attack object or an array of attack objects
    const attacks = Array.isArray(mode) ? mode : [mode];
    return attacks.flatMap((attack, i) => <AttackRow key={i} attack={attack} />);
}

export default function Attacks(key) {
    return function format(row) {
        const attacks = row[key];
        if (!attacks || (Array.isArray(attacks) && attacks.length === 0) || (typeof attacks === 'object' && !Array.isArray(attacks) && Object.keys(attacks).length === 0)) {
            return <span style={{color: 'var(--ifm-color-secondary)'}}>—</span>;
        }

        // Normalise to array of modes
        const modes = Array.isArray(attacks) ? attacks : [attacks];

        return (
            <table style={{borderCollapse: 'collapse', fontSize: '0.85em', margin: 0, width: '100%'}}>
                <tbody>
                    {modes.map((mode, i) => {
                        const rows = <AttackMode key={i} mode={mode} />;
                        // Add a thin separator between modes
                        if (i > 0) {
                            return [
                                <tr key={`sep-${i}`}><td colSpan={4} style={{borderTop: '1px solid var(--ifm-table-border-color)', padding: 0}}></td></tr>,
                                rows,
                            ];
                        }
                        return rows;
                    })}
                </tbody>
            </table>
        );
    };
}
