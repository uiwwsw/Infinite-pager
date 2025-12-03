import React from "react";
import useInfinitePagination from "./useInfinitePagination";

type PaginatorProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onVisibleBottom: () => void;
  rootMargin?: string;
};

type StoryArgs = {
  totalPages: number;
  initialPage?: number;
  rootMargin?: string;
};

function Paginator({ currentPage, totalPages, onPageChange, onVisibleBottom, rootMargin }: PaginatorProps) {
  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 360 }}>
      <div>
        <strong>Pagination</strong>
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
          <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}>
            Prev
          </button>
          <span>
            Page {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
          >
            Next
          </button>
        </div>
      </div>

      <div>
        <strong>Infinite scroll sentinel</strong>
        <p style={{ margin: "8px 0" }}>Root margin: {rootMargin || "(default)"}</p>
        <button onClick={onVisibleBottom} disabled={currentPage >= totalPages}>
          Simulate sentinel visible
        </button>
      </div>
    </div>
  );
}

export function PaginatorStory(args: StoryArgs) {
  const pagination = useInfinitePagination({
    totalPages: args.totalPages,
    initialPage: args.initialPage,
    rootMargin: args.rootMargin,
  });

  const storyProps: PaginatorProps = {
    ...args,
    currentPage: pagination.currentPage,
    totalPages: pagination.totalPages,
    onVisibleBottom: pagination.onVisibleBottom,
    onPageChange: pagination.onPageChange,
  };

  return <Paginator {...storyProps} />;
}

PaginatorStory.args = {
  totalPages: 6,
  initialPage: 1,
  rootMargin: "0px 0px 32px 0px",
};

export default {
  title: "Pagination/Paginator",
  component: PaginatorStory,
};
