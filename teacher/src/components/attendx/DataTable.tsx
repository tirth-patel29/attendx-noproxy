import * as React from "react";
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { rowVariants } from "@/lib/motion";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  pageSize?: number;
  toolbar?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  searchPlaceholder = "Search…",
  searchKeys = [],
  pageSize = 10,
  toolbar,
  emptyTitle = "No results",
  emptyDescription = "Nothing matches your current filters.",
  emptyIcon,
  loading = false,
  className,
}: DataTableProps<T>) {
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const filtered = React.useMemo(() => {
    if (!query.trim() || searchKeys.length === 0) return data;
    const q = query.toLowerCase();
    return data.filter((row) =>
      searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q)),
    );
  }, [data, query, searchKeys]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset to page 1 when search changes
  React.useEffect(() => {
    setPage(1);
  }, [query]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="data-table-search"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-9 text-[13px]"
          />
        </div>
        {toolbar ? (
          <div className="flex items-center gap-2">
            {toolbar}
          </div>
        ) : null}
      </div>

      {/* Table */}
      <div className="surface-card overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-canvas hover:bg-canvas">
                {columns.map((col) => (
                  <TableHead
                    key={String(col.key)}
                    className={cn(
                      "h-10 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
                      col.headerClassName,
                    )}
                  >
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-border">
                    {columns.map((col) => (
                      <TableCell key={String(col.key)}>
                        <div className="shimmer h-4 w-24 rounded-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-40 p-0">
                    <EmptyState
                      title={emptyTitle}
                      description={emptyDescription}
                      icon={emptyIcon ?? <SlidersHorizontal />}
                      className="rounded-none border-none py-12"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                <AnimatePresence mode="popLayout">
                  {paged.map((row, i) => (
                    <motion.tr
                      key={keyExtractor(row)}
                      variants={rowVariants}
                      initial="hidden"
                      animate="show"
                      custom={i}
                      className="border-b border-border transition-colors hover:bg-canvas/60"
                    >
                      {columns.map((col) => (
                        <TableCell
                          key={String(col.key)}
                          className={cn("py-3 text-[13px]", col.className)}
                        >
                          {col.render
                            ? col.render(row)
                            : String((row as Record<string, unknown>)[String(col.key)] ?? "—")}
                        </TableCell>
                      ))}
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[12.5px] text-muted-foreground">
          <span>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1">
            <Button
              id="datatable-prev"
              variant="ghost"
              size="icon-sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-[4rem] text-center">
              {currentPage} / {totalPages}
            </span>
            <Button
              id="datatable-next"
              variant="ghost"
              size="icon-sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
