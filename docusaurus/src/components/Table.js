import { useRef, useEffect, useState } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { FilterMatchMode, FilterService } from "primereact/api";

function FullWidthWrapper({ children }) {
  const ref = useRef(null);
  const [style, setStyle] = useState({});

  useEffect(() => {
    function update() {
      if (!ref.current) return;
      const left = ref.current.getBoundingClientRect().left;
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      const availableWidth = window.innerWidth - scrollbarWidth - left;
      setStyle({
        width: availableWidth - 24 + "px",
      });
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div ref={ref} style={style}>
      {children}
    </div>
  );
}

function buildInitialFilters(columns) {
  const filters = {};
  for (const col of columns) {
    filters[col.key] = {
      value: null,
      matchMode: col.numeric
        ? FilterMatchMode.GREATER_THAN_OR_EQUAL_TO
        : col.filterText
          ? FilterMatchMode.CUSTOM
          : FilterMatchMode.CONTAINS,
    };
  }
  return filters;
}

export default function Table({
  columns,
  data,
  fullWidth = false,
  filterable = false,
  sortable = true,
}) {
  const [filters, setFilters] = useState(() => buildInitialFilters(columns));
  // Columns marked `detail: true` are hidden until the reader switches details on
  const hasDetails = columns.some((col) => col.detail);
  const [showDetails, setShowDetails] = useState(false);
  const visibleColumns = hasDetails && !showDetails
    ? columns.filter((col) => !col.detail)
    : columns;

  function toggleDetails() {
    if (showDetails) {
      // Don't keep filtering by columns the reader can no longer see
      setFilters((current) => {
        const next = { ...current };
        for (const col of columns) {
          if (col.detail) next[col.key] = { ...next[col.key], value: null };
        }
        return next;
      });
    }
    setShowDetails(!showDetails);
  }

  columns.forEach((col) => {
    if (col.filterText) {
      FilterService.register(`custom_${col.key}`, (value, filter) => {
        if (!filter) return true;
        return col
          .filterText(value)
          .toLowerCase()
          .includes(filter.toLowerCase());
      });
    }
  });

  const table = (
    <DataTable
      value={data}
      sortMode="multiple"
      selectionMode="multiple"
      filters={filterable ? filters : undefined}
      onFilter={filterable ? (e) => setFilters(e.filters) : undefined}
      filterDisplay={filterable ? "row" : undefined}
    >
      {visibleColumns.map((column) => (
        <Column
          key={column.key}
          field={column.key}
          header={column.name}
          sortable={sortable && column.sortable !== false}
          sortFunction={
            column.sortValue
              ? (e) =>
                  [...e.data].sort((a, b) => {
                    const va = column.sortValue(a) ?? -Infinity;
                    const vb = column.sortValue(b) ?? -Infinity;
                    return e.order * (va < vb ? -1 : va > vb ? 1 : 0);
                  })
              : undefined
          }
          body={column.format}
          align={column.align}
          filter={filterable}
          filterMatchMode={FilterMatchMode.CUSTOM}
          filterFunction={
            column.filterValue
              ? (value, filter) => {
                  if (filter === null || filter === undefined || filter === "")
                    return true;
                  return column.filterValue(value) >= filter;
                }
              : column.numeric
                ? (value, filter) => {
                    if (
                      filter === null ||
                      filter === undefined ||
                      filter === ""
                    )
                      return true;
                    return value >= filter;
                  }
                : (value, filter) => {
                    if (!filter) return true;
                    return String(value ?? "")
                      .toLowerCase()
                      .includes(String(filter).toLowerCase());
                  }
          }
          showFilterMenu={false}
          filterPlaceholder={column.numeric ? "Min" : "Search"}
          dataType={column.numeric ? "numeric" : undefined}
        />
      ))}
    </DataTable>
  );

  const content = hasDetails ? (
    <>
      <div style={{ marginBottom: "0.5rem" }}>
        <button
          type="button"
          className={`button button--sm ${showDetails ? "button--primary" : "button--secondary"}`}
          aria-pressed={showDetails}
          onClick={toggleDetails}
        >
          {showDetails ? "Hide details" : "Show details"}
        </button>
      </div>
      {table}
    </>
  ) : table;

  if (fullWidth) {
    return <FullWidthWrapper>{content}</FullWidthWrapper>;
  }

  return content;
}
