import { useRef, useEffect, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { FilterMatchMode } from 'primereact/api';

function FullWidthWrapper({ children }) {
    const ref = useRef(null);
    const [style, setStyle] = useState({});

    useEffect(() => {
        function update() {
            if (!ref.current) return;
            const left = ref.current.getBoundingClientRect().left;
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
            const availableWidth = window.innerWidth - scrollbarWidth - left;
            setStyle({
                width: (availableWidth - 24) + 'px',
            });
        }
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
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
            matchMode: col.numeric ? FilterMatchMode.GREATER_THAN_OR_EQUAL_TO : FilterMatchMode.CONTAINS,
        };
    }
    return filters;
}

export default function Table({columns, data, fullWidth = false, filterable = false}) {
    const [filters, setFilters] = useState(() => buildInitialFilters(columns));

    const table = (
        <DataTable
            value={data}
            sortMode="multiple"
            selectionMode="multiple"
            filters={filterable ? filters : undefined}
            onFilter={filterable ? (e) => setFilters(e.filters) : undefined}
            filterDisplay={filterable ? 'row' : undefined}
        >
            {columns.map(column => (
                <Column
                    key={column.key}
                    field={column.key}
                    header={column.name}
                    sortable={column.sortable !== false}
                    body={column.format}
                    align={column.align}
                    filter={filterable}
                    filterMatchMode={FilterMatchMode.CUSTOM}
                    filterFunction={column.filterValue
                        ? (value, filter) => {
                            if (filter === null || filter === undefined || filter === '') return true;
                            return column.filterValue(value) >= filter;
                        }
                        : column.numeric
                            ? (value, filter) => {
                                if (filter === null || filter === undefined || filter === '') return true;
                                return value >= filter;
                            }
                            : (value, filter) => {
                                if (!filter) return true;
                                return String(value ?? '').toLowerCase().includes(String(filter).toLowerCase());
                            }
                    }
                    showFilterMenu={false}
                    filterPlaceholder={column.numeric ? 'Min' : 'Search'}
                    dataType={column.numeric ? 'numeric' : undefined}
                />
            ))}
        </DataTable>
    );

    if (fullWidth) {
        return <FullWidthWrapper>{table}</FullWidthWrapper>;
    }

    return table;
}
