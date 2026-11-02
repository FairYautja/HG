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

/**
 * Class filter: a full class name (e.g. from clicking a class) matches only that class,
 * so "HUNTER" doesn't also match Jungle Hunter; anything else is a substring search.
 */
export function classesFilterMatch(characters) {
  const names = (classes) =>
    classes.map((id) => characters.find((c) => c.id === id)?.name ?? "");
  return function match(classes, filter) {
    const query = String(filter).toLowerCase();
    const exact = characters.some((c) => c.name.toLowerCase() === query);
    return names(classes).some((name) =>
      exact ? name.toLowerCase() === query : name.toLowerCase().includes(query),
    );
  };
}

export function SpecializationClassList(characters) {
  return function format(row, options) {
    const { colorMode } = useColorMode();
    const chars = row.classes
      .map((character_id) => characters.find((c) => c.id === character_id))
      .filter(Boolean);
    // In a filterable table, clicking a class searches for it (clicking again clears it)
    const setFilter = options?.setFilter;
    return (
      <span style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
        {chars.map((c) => (
          <span
            key={c.id}
            title={setFilter ? `Show specializations of ${c.name}` : c.name}
            role={setFilter ? "button" : undefined}
            tabIndex={setFilter ? 0 : undefined}
            onClick={setFilter ? () => setFilter(c.name) : undefined}
            onKeyDown={
              setFilter
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setFilter(c.name);
                    }
                  }
                : undefined
            }
            style={{
              cursor: setFilter ? "pointer" : undefined,
              outline:
                options?.filterValue === c.name
                  ? "1px solid var(--ifm-color-primary)"
                  : undefined,
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
