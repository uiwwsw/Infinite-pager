import { useCallback, useEffect, useMemo, useState } from "react";

export type PageStatus = "idle" | "loading" | "loaded" | "error";

export interface PageRecord<T> {
  page: number;
  status: PageStatus;
  items?: T[];
  error?: unknown;
}

export interface PageWindow {
  startPage: number;
  endPage: number;
}

export interface InfinitePaperOptions<T> {
  pageSize: number;
  totalPages: number;
  /**
   * Number of pages to keep in memory at once. Defaults to 10.
   */
  windowSize?: number;
  /**
   * Initial page to focus. Defaults to 1.
   */
  initialPage?: number;
  /**
   * How close (in pages) the viewport needs to be to either end of the window
   * before the window recenters around the visible page. Defaults to 1.
   */
  prefetchThresholdPages?: number;
  fetchPage: (page: number) => Promise<T[]>;
  onPageChange?: (page: number) => void;
}

export interface PaperItem<T> {
  page: number;
  indexInPage: number;
  globalIndex: number;
  item?: T;
  isPlaceholder: boolean;
}

export interface InfinitePaperReturn<T> {
  /** Items for the current window (length = windowSize * pageSize). */
  items: PaperItem<T>[];
  /** Inclusive page range the hook currently keeps in memory. */
  pageWindow: PageWindow;
  /** Current page derived from viewport callbacks. */
  currentPage: number;
  /** Offset for the first item in the window (0-based global index). */
  windowOffset: number;
  /** True whenever at least one page in the window is loading. */
  isFetching: boolean;
  /** Map of page records for introspection/debugging. */
  pages: Map<number, PageRecord<T>>;
  /**
   * Recenter the window and request the page. The consumer should scroll their
   * virtual list to `globalIndex` (0-based) returned from the promise. The
   * returned `targetWindowOffset` reflects the window after the jump so the
   * caller can compute the scrollTop in a single calculation.
   */
  scrollToPage: (
    page: number
  ) => Promise<{ targetGlobalIndex: number; targetWindowOffset: number }>;
  /**
   * Convert a visible range (relative to the window items) into pagination
   * updates and window shifting when the user scrolls.
   */
  handleVisibleRange: (visibleStartIndex: number, visibleStopIndex: number) => void;
  /** Manually invalidate and refetch a page within the current window. */
  reloadPage: (page: number) => void;
  /** Highest page that has been reached through scrolling or jumps. */
  maxAccessiblePage: number;
  /** Pagination structure following Amazon's pagination visibility rules. */
  paginationItems: PaginationItem[];
  pageSize: number;
  totalPages: number;
}

export type PaginationItemType = "page" | "ellipsis" | "prev" | "next";

export interface PaginationItem {
  type: PaginationItemType;
  page?: number;
  isCurrent?: boolean;
  disabled?: boolean;
}

function clampWindow(targetPage: number, totalPages: number, windowSize: number): PageWindow {
  const half = Math.floor(windowSize / 2);
  const startPage = Math.max(1, Math.min(targetPage - half, totalPages - windowSize + 1));
  const endPage = Math.min(totalPages, startPage + windowSize - 1);
  return { startPage, endPage };
}

function pageFromIndex(index: number, pageSize: number): number {
  return Math.floor(index / pageSize) + 1;
}

function buildAmazonStylePagination(
  currentPage: number,
  maxAccessiblePage: number
): PaginationItem[] {
  if (maxAccessiblePage < 1) return [];

  const clampedCurrent = Math.min(Math.max(1, currentPage), maxAccessiblePage);
  const items: PaginationItem[] = [];
  const addPage = (page: number) => {
    items.push({ type: "page", page, isCurrent: page === clampedCurrent });
  };
  const addEllipsis = () => items.push({ type: "ellipsis" });

  items.push({
    type: "prev",
    page: Math.max(1, clampedCurrent - 1),
    disabled: clampedCurrent <= 1,
  });

  const maxSlots = 7;
  const total = maxAccessiblePage;

  if (total <= maxSlots) {
    for (let page = 1; page <= total; page += 1) {
      addPage(page);
    }
  } else if (clampedCurrent <= 4) {
    for (let page = 1; page <= 5; page += 1) {
      addPage(page);
    }
    addEllipsis();
    addPage(total);
  } else if (clampedCurrent >= total - 3) {
    addPage(1);
    addEllipsis();
    for (let page = total - 4; page <= total; page += 1) {
      addPage(page);
    }
  } else {
    addPage(1);
    addEllipsis();
    for (let page = clampedCurrent - 1; page <= clampedCurrent + 1; page += 1) {
      addPage(page);
    }
    addEllipsis();
    addPage(total);
  }

  items.push({
    type: "next",
    page: Math.min(total, clampedCurrent + 1),
    disabled: clampedCurrent >= total,
  });

  return items;
}

export function useInfinitePaper<T>(options: InfinitePaperOptions<T>): InfinitePaperReturn<T> {
  const {
    pageSize,
    totalPages,
    fetchPage,
    windowSize = 10,
    initialPage = 1,
    prefetchThresholdPages = 1,
    onPageChange,
  } = options;

  const [pageWindow, setPageWindow] = useState<PageWindow>(() =>
    clampWindow(initialPage, totalPages, Math.max(1, windowSize))
  );
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [pages, setPages] = useState<Map<number, PageRecord<T>>>(new Map());
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [maxAccessiblePage, setMaxAccessiblePage] = useState<number>(0);

  const windowOffset = useMemo(
    () => (pageWindow.startPage - 1) * pageSize,
    [pageWindow.startPage, pageSize]
  );

  // Keep the pages map aligned with the current window (add missing placeholders, drop out of range).
  useEffect(() => {
    setPages((prev) => {
      const next = new Map<number, PageRecord<T>>();
      for (let page = pageWindow.startPage; page <= pageWindow.endPage; page += 1) {
        const existing = prev.get(page);
        if (existing) {
          next.set(page, existing);
        } else {
          next.set(page, { page, status: "idle" });
        }
      }
      return next;
    });
  }, [pageWindow.endPage, pageWindow.startPage]);

  const loadPage = useCallback(
    async (page: number) => {
      let shouldFetch = true;
      setPages((prev) => {
        const existing = prev.get(page);
        if (existing && existing.status === "loading") {
          shouldFetch = false;
          return prev;
        }
        const next = new Map(prev);
        next.set(page, { page, status: "loading" });
        return next;
      });
      if (!shouldFetch) return;

      try {
        const items = await fetchPage(page);
        setPages((prev) => {
          const existing = prev.get(page);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(page, {
            page,
            status: "loaded",
            items,
          });
          return next;
        });
      } catch (error) {
        setPages((prev) => {
          const existing = prev.get(page);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(page, { page, status: "error", error });
          return next;
        });
      }
    },
    [fetchPage]
  );

  // Fetch missing pages whenever the window changes.
  useEffect(() => {
    const missing: number[] = [];
    pages.forEach((record, page) => {
      if (page < pageWindow.startPage || page > pageWindow.endPage) return;
      if (record.status === "idle" || record.status === "error") {
        missing.push(page);
      }
    });
    if (missing.length === 0) return;

    let cancelled = false;
    setIsFetching(true);
    (async () => {
      await Promise.all(missing.map((page) => loadPage(page)));
      if (!cancelled) {
        setIsFetching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadPage, pageWindow.endPage, pageWindow.startPage, pages]);

  // Keep isFetching in sync when all pages are already loaded/loading state flips.
  useEffect(() => {
    const loading = Array.from(pages.values()).some((page) => page.status === "loading");
    setIsFetching(loading);
  }, [pages]);

  const scrollToPage = useCallback(
    async (targetPage: number) => {
      const clamped = Math.min(Math.max(1, targetPage), totalPages);
      const desiredWindow = clampWindow(clamped, totalPages, Math.max(1, windowSize));

      setCurrentPage(clamped);
      setPageWindow(desiredWindow);
      setMaxAccessiblePage((prev) => Math.max(prev, clamped));

      const targetGlobalIndex = (clamped - 1) * pageSize;
      const targetWindowOffset = (desiredWindow.startPage - 1) * pageSize;
      return { targetGlobalIndex, targetWindowOffset };
    },
    [pageSize, totalPages, windowSize]
  );

  const reloadPage = useCallback((page: number) => {
    setPages((prev) => {
      if (!prev.has(page)) return prev;
      const next = new Map(prev);
      next.set(page, { page, status: "idle" });
      return next;
    });
  }, []);

  const handleVisibleRange = useCallback(
    (visibleStartIndex: number, visibleStopIndex: number) => {
      // Support both window-relative and absolute indices from virtualizers.
      // If the indices do not map inside the current window, treat them as
      // global so that large jumps (e.g., jumping from page 1 to 1000) re-center
      // the window in a single step instead of sliding through intermediate
      // ranges.
      const windowLength = windowSize * pageSize;
      const startFromWindow = windowOffset + visibleStartIndex;
      const stopFromWindow = windowOffset + visibleStopIndex;
      const indicesFitWindow =
        pageFromIndex(startFromWindow, pageSize) >= pageWindow.startPage &&
        pageFromIndex(stopFromWindow, pageSize) <= pageWindow.endPage;
      const indicesAreGlobal =
        !indicesFitWindow ||
        visibleStartIndex >= windowLength ||
        visibleStopIndex >= windowLength;
      const globalStart = indicesAreGlobal
        ? visibleStartIndex
        : startFromWindow;
      const globalStop = indicesAreGlobal ? visibleStopIndex : stopFromWindow;
      const nextPage = pageFromIndex(globalStart, pageSize);

      if (nextPage !== currentPage) {
        setCurrentPage(nextPage);
        onPageChange?.(nextPage);
      }

      setMaxAccessiblePage((prev) => Math.max(prev, Math.min(totalPages, nextPage)));

      const topPage = pageFromIndex(globalStart, pageSize);
      const bottomPage = pageFromIndex(globalStop, pageSize);

      const nearTop = topPage <= pageWindow.startPage + prefetchThresholdPages;
      const nearBottom = bottomPage >= pageWindow.endPage - prefetchThresholdPages;

      if (indicesAreGlobal) {
        const desiredWindow = clampWindow(nextPage, totalPages, Math.max(1, windowSize));
        if (
          desiredWindow.startPage !== pageWindow.startPage ||
          desiredWindow.endPage !== pageWindow.endPage
        ) {
          setPageWindow(desiredWindow);
        }
        return;
      }

      if (nearTop && pageWindow.startPage > 1) {
        const target = Math.max(1, topPage);
        setPageWindow(clampWindow(target, totalPages, Math.max(1, windowSize)));
      } else if (nearBottom && pageWindow.endPage < totalPages) {
        const target = Math.min(totalPages, bottomPage);
        setPageWindow(clampWindow(target, totalPages, Math.max(1, windowSize)));
      }
    },
    [currentPage, onPageChange, pageSize, pageWindow.endPage, pageWindow.startPage, prefetchThresholdPages, totalPages, windowOffset, windowSize]
  );

  const items = useMemo<PaperItem<T>[]>(() => {
    const result: PaperItem<T>[] = [];
    let offset = 0;
    for (let page = pageWindow.startPage; page <= pageWindow.endPage; page += 1) {
      const record = pages.get(page);
      for (let i = 0; i < pageSize; i += 1) {
        const item = record?.items?.[i];
        result.push({
          page,
          indexInPage: i,
          globalIndex: windowOffset + offset,
          item,
          isPlaceholder: !record || record.status !== "loaded" || typeof item === "undefined",
        });
        offset += 1;
      }
    }
    return result;
  }, [pageSize, pageWindow.endPage, pageWindow.startPage, pages, windowOffset]);

  const paginationItems = useMemo(
    () => buildAmazonStylePagination(currentPage, maxAccessiblePage),
    [currentPage, maxAccessiblePage]
  );

  return {
    items,
    pageWindow,
    currentPage,
    windowOffset,
    isFetching,
    pages,
    scrollToPage,
    handleVisibleRange,
    reloadPage,
    maxAccessiblePage,
    paginationItems,
    pageSize,
    totalPages,
  };
}

export default useInfinitePaper;
