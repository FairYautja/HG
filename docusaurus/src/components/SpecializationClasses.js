export default function SpecializationClasses(characters) {
    return function format(row) {
        return <span title={row.classes.map(character_id => {
                const character = characters.find(character => character.id == character_id);
                return character ? character.name : undefined
        }).join(", ")}
        >{row.name}</span>;
    }
}
