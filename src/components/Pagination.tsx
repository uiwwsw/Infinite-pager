import React from "react";
import type { PaginationItem } from "../paginationTypes";

export interface PaginationProps {
  items: PaginationItem[];
  onPageChange: (page: number) => void;
  className?: string;
  renderEllipsis?: () => React.ReactNode;
}

export function Pagination({ items, onPageChange, className, renderEllipsis }: PaginationProps) {
  if (!items.length) return null;

  return (
    <nav className={className} aria-label="Pagination">
      <ul style={{ display: "flex", listStyle: "none", gap: 8, padding: 0, margin: 0 }}>
        {items.map((item, index) => {
          if (item.type === "ellipsis") {
            return (
              <li key={`ellipsis-${index}`}>{renderEllipsis ? renderEllipsis() : <span aria-hidden>…</span>}</li>
            );
          }

          const label = item.type === "prev" ? "Prev" : item.type === "next" ? "Next" : item.page;

          return (
            <li key={`page-${item.type}-${item.page ?? index}`}>
              <button
                type="button"
                onClick={() => item.page && onPageChange(item.page)}
                disabled={item.disabled}
                aria-current={item.isCurrent ? "page" : undefined}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default Pagination;
