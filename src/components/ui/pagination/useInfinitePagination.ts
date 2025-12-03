import { useCallback, useMemo, useState } from "react";

export interface InfinitePaginationOptions {
  totalPages: number;
  /**
   * Initial page to display. Defaults to 1.
   */
  initialPage?: number;
  /**
   * Called whenever the current page changes via scrolling or direct selection.
   */
  onPageChange?: (page: number) => void;
  /**
   * Optional scroll container to forward to the IntersectionObserver used by the
   * InfiniteScroll component.
   */
  scrollContainer?: Element | null;
  /**
   * Optional root margin to forward to the IntersectionObserver used by the
   * InfiniteScroll component.
   */
  rootMargin?: string;
}

export interface InfinitePaginationHandlers {
  currentPage: number;
  totalPages: number;
  setPage: (page: number) => void;
  goToNextPage: () => void;
  onVisibleBottom: () => void;
  onPageChange: (page: number) => void;
  hasNextPage: boolean;
  infiniteScrollOptions: {
    onVisible: () => void;
    root?: Element | null;
    rootMargin?: string;
  };
}

function clampPage(page: number, totalPages: number): number {
  if (Number.isNaN(page)) return 1;
  return Math.min(Math.max(1, page), Math.max(1, totalPages));
}

export function useInfinitePagination(options: InfinitePaginationOptions): InfinitePaginationHandlers {
  const { totalPages, initialPage = 1, onPageChange, scrollContainer, rootMargin } = options;

  const [currentPage, setCurrentPage] = useState<number>(() => clampPage(initialPage, totalPages));

  const emitChange = useCallback(
    (nextPage: number) => {
      onPageChange?.(nextPage);
    },
    [onPageChange]
  );

  const setPage = useCallback(
    (page: number) => {
      const clamped = clampPage(page, totalPages);
      setCurrentPage((prev) => {
        if (prev === clamped) return prev;
        emitChange(clamped);
        return clamped;
      });
    },
    [emitChange, totalPages]
  );

  const goToNextPage = useCallback(() => {
    setCurrentPage((prev) => {
      const next = clampPage(prev + 1, totalPages);
      if (next === prev) return prev;
      emitChange(next);
      return next;
    });
  }, [emitChange, totalPages]);

  const onVisibleBottom = useCallback(() => {
    goToNextPage();
  }, [goToNextPage]);

  const infiniteScrollOptions = useMemo(
    () => ({
      onVisible: onVisibleBottom,
      root: scrollContainer ?? null,
      rootMargin,
    }),
    [onVisibleBottom, rootMargin, scrollContainer]
  );

  return {
    currentPage,
    totalPages,
    setPage,
    goToNextPage,
    onVisibleBottom,
    onPageChange: setPage,
    hasNextPage: currentPage < totalPages,
    infiniteScrollOptions,
  };
}

export default useInfinitePagination;
