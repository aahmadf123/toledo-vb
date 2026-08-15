"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * The one sortable table. Wraps TanStack Table with the app's dark styling:
 * click-to-sort headers with aria-sort, optional sticky first column for wide
 * tables, optional column-visibility menu, optional row links.
 */
export default function DataTable<T>({
  columns,
  data,
  initialSort = [],
  stickyFirstCol = false,
  columnToggle = false,
  getRowHref,
  minWidthClass,
  footerRow,
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  initialSort?: SortingState;
  stickyFirstCol?: boolean;
  /** Show a column-visibility dropdown above the table. */
  columnToggle?: boolean;
  getRowHref?: (row: T) => string | undefined;
  minWidthClass?: string;
  /** Pinned non-sorting row rendered after the body (e.g. team totals). */
  footerRow?: React.ReactNode;
}) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>(initialSort);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const stickyCell = (index: number, extra?: string) =>
    cn(stickyFirstCol && index === 0 && "sticky left-0 z-10 bg-card", extra);

  return (
    <div>
      {columnToggle ? (
        <div className="mb-2 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="border-navy-700 text-ink-muted">
                  <Columns3 data-icon="inline-start" />
                  Columns
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={c.getIsVisible()}
                    onCheckedChange={(v) => c.toggleVisibility(!!v)}
                  >
                    {typeof c.columnDef.header === "string" ? c.columnDef.header : c.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-navy-700 bg-card">
        <table className={cn("w-full text-sm", minWidthClass)}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-navy-700 text-xs text-muted-foreground">
                {hg.headers.map((header, i) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  const alignRight =
                    (header.column.columnDef.meta as { align?: string } | undefined)?.align ===
                    "right";
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      aria-sort={
                        sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                      }
                      className={stickyCell(
                        i,
                        cn(
                          "px-3 py-2 font-medium first:pl-4 last:pr-4",
                          alignRight ? "text-right" : "text-left",
                          header.isPlaceholder && "border-b border-navy-700/50"
                        )
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "inline-flex items-center gap-1 rounded focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
                            sorted ? "text-ink" : "hover:text-ink"
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ChevronsUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const href = getRowHref?.(row.original);
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-navy-700/50 last:border-0",
                    href && "cursor-pointer transition-colors hover:bg-navy-800/60"
                  )}
                  onClick={href ? () => router.push(href) : undefined}
                >
                  {row.getVisibleCells().map((cell, i) => {
                    const alignRight =
                      (cell.column.columnDef.meta as { align?: string } | undefined)?.align ===
                      "right";
                    return (
                      <td
                        key={cell.id}
                        className={stickyCell(
                          i,
                          cn(
                            "px-3 py-2 first:pl-4 last:pr-4",
                            alignRight && "text-right tabular-nums"
                          )
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          {footerRow ? <tfoot>{footerRow}</tfoot> : null}
        </table>
      </div>
    </div>
  );
}
