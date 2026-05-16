import { useColorMode } from "@docusaurus/theme-common";

export default function SpecializationClasses(characters) {
  return function format(row) {
    return (
      <span
        title={row.classes
          .map((character_id) => {
            const character = characters.find(
              (character) => character.id == character_id,
            );
            return character ? character.name : undefined;
          })
          .join(", ")}
      >
        {row.name}
      </span>
    );
  };
}

export function classesFilterValue(characters) {
  return function filterValue(classes) {
    return classes
      .map((id) => {
        const c = characters.find((c) => c.id === id);
        return c ? c.name : "";
      })
      .join(" ");
  };
}

export function SpecializationClassList(characters) {
  return function format(row) {
    const { colorMode } = useColorMode();
    const chars = row.classes
      .map((character_id) => characters.find((c) => c.id === character_id))
      .filter(Boolean);
    return (
      <span style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
        {chars.map((c) => (
          <span
            key={c.id}
            title={c.name}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "1px 6px",
              borderRadius: "4px",
              background: "var(--ifm-color-emphasis-200)",
              fontSize: "0.8em",
              whiteSpace: "nowrap",
            }}
          >
            {c.icon && (
              <img
                src={c.icon}
                style={{
                  width: "16px",
                  height: "16px",
                  filter: `invert(${colorMode === "dark" ? 0 : 0.7})`,
                }}
              />
            )}
            {c.name}
          </span>
        ))}
      </span>
    );
  };
}
