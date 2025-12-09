import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { PaginationItem } from "./paginationTypes";
import { useIntersectionSentinel } from "./hooks/useIntersectionSentinel";
import { useSimpleScroll } from "./hooks/useSimpleScroll";

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
  /**
   * Optional scroll container for infinite scroll helpers. Defaults to the viewport.
   */
  scrollContainer?: Element | null;
  /**
   * Root margin to use for the intersection observer helpers. Defaults to undefined.
   */
  rootMargin?: string;
  /**
   * If provided, the hook will automatically attach scroll listeners to the container
   * and calculate visible pages based on this fixed item height.
   */
  itemHeight?: number;
  /**
   * Optional ref for the container. If not provided, one will be created and returned.
   */
  containerRef?: RefObject<HTMLElement>;
  /**
   * Optional offset to subtract from scrollTop (e.g. for sticky headers). Defaults to 0.
   */
  headerOffset?: number;
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
  /** Convenience alias for scrollToPage. */
  setPage: (
    page: number
  ) => Promise<{ targetGlobalIndex: number; targetWindowOffset: number }>;
  /** Jump forward a single page if possible. */
  goToNextPage: () => Promise<{ targetGlobalIndex: number; targetWindowOffset: number }>;
  /**
   * Convert a visible range (relative to the window items) into pagination
   * updates and window shifting when the user scrolls.
   */
  handleVisibleRange: (
    visibleStartIndex: number,
    visibleStopIndex: number,
    indexType?: "auto" | "global" | "relative"
  ) => void;
  /** Manually invalidate and refetch a page within the current window. */
  reloadPage: (page: number) => void;
  /** Highest page that has been reached through scrolling or jumps. */
  maxAccessiblePage: number;
  /** Whether another page exists beyond the current maximum. */
  hasNextPage: boolean;
  /** Pagination structure following Amazon's pagination visibility rules. */
  paginationItems: PaginationItem[];
  /** Trigger fetching the next page when an infinite scroll sentinel becomes visible. */
  onVisibleBottom: () => Promise<void>;
  /** Prepared options for an IntersectionObserver sentinel. */
  infiniteScrollOptions: { onVisible: () => Promise<void>; root: Element | null; rootMargin?: string };
  pageSize: number;
  totalPages: number;
  /** Ref to attach to the scroll container. */
  containerRef: RefObject<any>;
  /** Ref to attach to the intersection sentinel element. */
  sentinelRef: RefObject<any>;
  /** Calculated height for the top spacer (when using itemHeight). */
  topSpacerHeight: number;
  /** Calculated height for the bottom spacer (when using itemHeight). */
  bottomSpacerHeight: number;
}

function clampWindow(
  targetPage: number,
  totalPages: number,
  windowSize: number
): PageWindow {
  const half = Math.floor(windowSize / 2);
  const startPage = Math.max(
    1,
    Math.min(targetPage - half, totalPages - windowSize + 1)
  );
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

export function useInfinitePaper<T>(
  options: InfinitePaperOptions<T>
): InfinitePaperReturn<T> {
  const {
    pageSize,
    totalPages,
    fetchPage,
    windowSize = 10,
    initialPage = 1,
    prefetchThresholdPages = 1,
    onPageChange,
    scrollContainer = null,
    rootMargin,
    itemHeight,
    containerRef: userContainerRef,
  } = options;

  const [pageWindow, setPageWindow] = useState<PageWindow>(() =>
    clampWindow(initialPage, totalPages, Math.max(1, windowSize))
  );
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [pages, setPages] = useState<Map<number, PageRecord<T>>>(new Map());
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [maxAccessiblePage, setMaxAccessiblePage] = useState<number>(initialPage);
  const pendingJumpPage = useRef<number | null>(null);

  // Internal refs for "batteries-included" mode
  const internalContainerRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLElement>(null);
  const containerRef = userContainerRef || internalContainerRef;

  const windowOffset = useMemo(
    () => (pageWindow.startPage - 1) * pageSize,
    [pageWindow.startPage, pageSize]
  );

  // Keep the pages map aligned with the current window (add missing placeholders, drop out of range).
  useEffect(() => {
    setPages((prev) => {
      let changed = false;
      const next = new Map<number, PageRecord<T>>();

      for (
        let page = pageWindow.startPage;
        page <= pageWindow.endPage;
        page += 1
      ) {
        const existing = prev.get(page);
        if (existing) {
          next.set(page, existing);
        } else {
          next.set(page, { page, status: "idle" });
          changed = true;
        }
      }

      // Check if any pages were removed (out of window)
      if (!changed && prev.size !== next.size) {
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [pageWindow.endPage, pageWindow.startPage]);

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

    // Batch "loading" state update
    setPages((prev) => {
      const next = new Map(prev);
      let changed = false;
      missing.forEach((page) => {
        const existing = next.get(page);
        if (!existing || existing.status !== "loading") {
          next.set(page, { page, status: "loading" });
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    let cancelled = false;
    setIsFetching(true);

    (async () => {
      await Promise.all(
        missing.map(async (page) => {
          try {
            const items = await fetchPage(page);
            if (cancelled) return;
            setPages((prev) => {
              const next = new Map(prev);
              next.set(page, { page, status: "loaded", items });
              return next;
            });
          } catch (error) {
            if (cancelled) return;
            setPages((prev) => {
              const next = new Map(prev);
              next.set(page, { page, status: "error", error });
              return next;
            });
          }
        })
      );
      if (!cancelled) {
        setIsFetching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchPage, pageWindow.endPage, pageWindow.startPage, pages]);

  // Keep isFetching in sync when all pages are already loaded/loading state flips.
  useEffect(() => {
    const loading = Array.from(pages.values()).some(
      (page) => page.status === "loading"
    );
    setIsFetching(loading);
  }, [pages]);

  const scrollToPage = useCallback(
    async (targetPage: number) => {
      const clamped = Math.min(Math.max(1, targetPage), totalPages);
      const desiredWindow = clampWindow(
        clamped,
        totalPages,
        Math.max(1, windowSize)
      );

      setCurrentPage(clamped);
      setPageWindow(desiredWindow);
      setMaxAccessiblePage((prev) => Math.max(prev, clamped));
      pendingJumpPage.current = clamped;

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

  const setPage = useCallback(
    async (page: number) => scrollToPage(page),
    [scrollToPage]
  );

  const goToNextPage = useCallback(
    async () => scrollToPage(currentPage + 1),
    [currentPage, scrollToPage]
  );

  const hasNextPage = useMemo(
    () => maxAccessiblePage < totalPages,
    [maxAccessiblePage, totalPages]
  );

  const onVisibleBottom = useCallback(async () => {
    if (!hasNextPage || isFetching) return;
    const target = Math.min(totalPages, Math.max(currentPage + 1, maxAccessiblePage + 1));
    await scrollToPage(target);
  }, [currentPage, hasNextPage, isFetching, maxAccessiblePage, scrollToPage, totalPages]);

  const infiniteScrollOptions = useMemo(
    () => ({
      onVisible: onVisibleBottom,
      root: scrollContainer,
      rootMargin,
    }),
    [onVisibleBottom, rootMargin, scrollContainer]
  );

  const handleVisibleRange = useCallback(
    (
      visibleStartIndex: number,
      visibleStopIndex: number,
      indexType: "auto" | "global" | "relative" = "auto"
    ) => {
      const windowLength = windowSize * pageSize;

      let globalStart: number;
      let globalStop: number;
      let indicesAreGlobal: boolean;

      if (indexType === "global") {
        indicesAreGlobal = true;
        globalStart = visibleStartIndex;
        globalStop = visibleStopIndex;
      } else if (indexType === "relative") {
        indicesAreGlobal = false;
        // If explicitly relative, we assume they are window-relative
        globalStart = windowOffset + visibleStartIndex;
        globalStop = windowOffset + visibleStopIndex;
      } else {
        // Auto detection (legacy behavior)
        const startFromWindow = windowOffset + visibleStartIndex;
        const stopFromWindow = windowOffset + visibleStopIndex;
        const indicesFitWindow =
          pageFromIndex(startFromWindow, pageSize) >= pageWindow.startPage &&
          pageFromIndex(stopFromWindow, pageSize) <= pageWindow.endPage;

        indicesAreGlobal =
          !indicesFitWindow ||
          visibleStartIndex >= windowLength ||
          visibleStopIndex >= windowLength;

        globalStart = indicesAreGlobal ? visibleStartIndex : startFromWindow;
        globalStop = indicesAreGlobal ? visibleStopIndex : stopFromWindow;
      }

      // 2. Determine Logic Mode (Jump vs Scroll)
      // If the resolved pages are NOT within the current window, we must jump.
      const topPage = pageFromIndex(globalStart, pageSize);
      const bottomPage = pageFromIndex(globalStop, pageSize);

      const pagesFitWindow =
        topPage >= pageWindow.startPage &&
        bottomPage <= pageWindow.endPage;

      const shouldJump = !pagesFitWindow;

      let nextPage = topPage;

      if (
        pendingJumpPage.current &&
        pendingJumpPage.current >= topPage &&
        pendingJumpPage.current <= bottomPage
      ) {
        nextPage = pendingJumpPage.current;
        pendingJumpPage.current = null;
      }

      if (nextPage !== currentPage) {
        setCurrentPage(nextPage);
        onPageChange?.(nextPage);
      }

      const furthestVisiblePage = Math.min(
        totalPages,
        Math.max(topPage, bottomPage)
      );
      setMaxAccessiblePage((prev) => Math.max(prev, furthestVisiblePage));

      const nearTop = topPage < pageWindow.startPage + prefetchThresholdPages;
      const nearBottom =
        bottomPage > pageWindow.endPage - prefetchThresholdPages;

      if (shouldJump) {
        const desiredWindow = clampWindow(
          nextPage,
          totalPages,
          Math.max(1, windowSize)
        );
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
    [
      currentPage,
      onPageChange,
      pageSize,
      pageWindow.endPage,
      pageWindow.startPage,
      prefetchThresholdPages,
      totalPages,
      windowOffset,
      windowSize,
    ]
  );

  // --- Batteries Included Logic ---
  // If itemHeight is provided, we assume the user wants the hook to handle
  // the scroll listening and sentinel observation automatically.

  const totalItemCount = totalPages * pageSize;
  const isJumping = useRef(false);

  // When jumping (setPage), we briefly disable the scroll listener to avoid fights.
  // We wrap the user's setPage to handle this.
  const batteriesIncludedSetPage = useCallback(async (page: number) => {
    if (itemHeight) {
      isJumping.current = true;
    }
    const result = await setPage(page);

    if (itemHeight) {
      // Auto-Scroll Logic
      if (containerRef.current) {
        const { targetGlobalIndex } = result;
        const headerOffset = options.headerOffset ?? 0;
        const top = targetGlobalIndex * itemHeight + headerOffset;
        containerRef.current.scrollTo({ top, behavior: "auto" });
      }

      // Re-enable after a short delay
      setTimeout(() => {
        isJumping.current = false;
      }, 100);
    }
    return result;
  }, [itemHeight, setPage, containerRef, options.headerOffset]);

  // Use the extracted scroll hook logic
  // If itemHeight is undefined, 'enabled' will be false (or effectively unused if we pass enabled=!!itemHeight)
  useSimpleScroll({
    containerRef: containerRef as RefObject<HTMLElement>,
    itemHeight: itemHeight ?? 0,
    totalItemCount,
    handleVisibleRange,
    enabled: !!itemHeight && !isJumping.current,
    headerOffset: options.headerOffset ?? 0,
  });

  // Use the extracted sentinel hook logic
  useIntersectionSentinel(sentinelRef.current, {
    root: infiniteScrollOptions.root,
    rootMargin: infiniteScrollOptions.rootMargin,
    onVisible: () => {
      // Only trigger if enabled
      if (itemHeight) {
        void infiniteScrollOptions.onVisible();
      }
    },
  });

  const items = useMemo<PaperItem<T>[]>(() => {
    const result: PaperItem<T>[] = [];
    let offset = 0;
    for (
      let page = pageWindow.startPage;
      page <= pageWindow.endPage;
      page += 1
    ) {
      const record = pages.get(page);
      for (let i = 0; i < pageSize; i += 1) {
        const item = record?.items?.[i];
        result.push({
          page,
          indexInPage: i,
          globalIndex: windowOffset + offset,
          item,
          isPlaceholder:
            !record ||
            record.status !== "loaded" ||
            typeof item === "undefined",
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

  // Calculate spacers
  const topSpacerHeight = (itemHeight ?? 0) * windowOffset;
  const visibleHeight = items.length * (itemHeight ?? 0);
  const bottomSpacerHeight = Math.max(0, totalItemCount * (itemHeight ?? 0) - topSpacerHeight - visibleHeight);

  return {
    items,
    pageWindow,
    currentPage,
    windowOffset,
    isFetching,
    pages,
    scrollToPage,
    setPage: batteriesIncludedSetPage, // Use the wrapped version
    goToNextPage,
    handleVisibleRange,
    reloadPage,
    maxAccessiblePage,
    hasNextPage,
    paginationItems,
    onVisibleBottom,
    infiniteScrollOptions,
    pageSize,
    totalPages,
    containerRef,
    sentinelRef,
    topSpacerHeight,
    bottomSpacerHeight,
  };
}

export default useInfinitePaper;
export { Pagination } from "./components/Pagination";
export type { PaginationProps } from "./components/Pagination";
export type { PaginationItem, PaginationItemType } from "./paginationTypes";
export { useIntersectionSentinel } from "./hooks/useIntersectionSentinel";
export { useSimpleScroll } from "./hooks/useSimpleScroll";
