import data from '/static/data.json';

const ARMOR_KEYS = ['Bullet_SmallCaliber', 'Bullet_HighCaliber', 'Bullet_Shotgun', 'FT_Explosive', 'FT_Slashing', 'Plasma'];

const predatorEHP = data.characters.predator.map(function(row) {
    const extra = {};
    for (var i = 0; i < ARMOR_KEYS.length; i++) {
        var k = ARMOR_KEYS[i];
        var v = row.armor && row.armor[k] != null ? row.armor[k] : 1;
        extra['eHP_' + k] = Math.round(row.health * v);
    }
    return Object.assign({}, row, extra);
});

export default predatorEHP;
