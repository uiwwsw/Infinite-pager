import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import useInfinitePaper, { Pagination } from "../../../index";
import type { PaginationItem } from "../../../paginationTypes";

const meta: Meta<typeof Pagination> = {
  title: "components/InfinitePaper",
  component: Pagination,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "인피니트 스크롤과 페이지네이션이 함께 동작하는 `useInfinitePaper` 훅의 데모입니다. 위쪽에는 페이지네이션 UI가 있고, 컨테이너 하단 sentinel 이 보이면 다음 페이지가 로드됩니다.",
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof meta>;

type InfinitePaperStoryArgs = {
  pageSize: number;
  totalPages: number;
  windowSize: number;
  rootMargin?: string;
};

const itemHeight = 120;

function buildPageItems(page: number, pageSize: number): string[] {
  const start = (page - 1) * pageSize + 1;
  return Array.from({ length: pageSize }, (_, index) => `Article #${start + index}`);
}

function useIntersectionSentinel(
  sentinel: Element | null,
  options: { root?: Element | null; rootMargin?: string; onVisible: () => void }
) {
  const { root, rootMargin, onVisible } = options;

  useEffect(() => {
    if (!sentinel) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onVisible();
          }
        });
      },
      { root: root ?? undefined, rootMargin }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onVisible, root, rootMargin, sentinel]);
}

function PaginationBar({
  items,
  onPageChange,
}: {
  items: PaginationItem[];
  onPageChange: (page: number) => Promise<void>;
}) {
  return (
    <div style={{ position: "sticky", top: 0, padding: "12px 0", background: "white", zIndex: 1 }}>
      <Pagination items={items} onPageChange={(page) => void onPageChange(page)} />
    </div>
  );
}

export const InfinitePaperDemo: Story = {
  args: {
    pageSize: 5,
    totalPages: 12,
    windowSize: 6,
    rootMargin: "0px 0px 240px 0px",
  },
  parameters: {
    docs: {
      description: {
        story:
          "스크롤을 내려 sentinel 이 보이면 자동으로 다음 페이지를 불러오고, 상단의 페이지네이션을 눌러 원하는 페이지로 점프할 수 있는 통합 데모입니다.",
      },
    },
  },
  render: function InfinitePaperStory(args: InfinitePaperStoryArgs) {
    const { pageSize, totalPages, windowSize, rootMargin } = args;
    const containerRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const previousWindowOffset = useRef(0);
    const isJumping = useRef(false);

    const fetchPage = useCallback(async (page: number) => {
      // 인디케이터가 보일 수 있도록 약간의 지연을 추가합니다.
      await new Promise((resolve) => setTimeout(resolve, 250));
      return buildPageItems(page, pageSize);
    }, [pageSize]);

    const {
      items,
      paginationItems,
      handleVisibleRange,
      infiniteScrollOptions,
      setPage,
      pageSize: resolvedPageSize,
      totalPages: resolvedTotalPages,
      windowOffset,
    } = useInfinitePaper<string>({
      pageSize,
      totalPages,
      windowSize,
      fetchPage,
      rootMargin,
    });

    const totalItemCount = resolvedTotalPages * resolvedPageSize;
    const headerRef = useRef<HTMLDivElement>(null);

    const getHeaderHeight = () => headerRef.current?.clientHeight ?? 0;

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return undefined;

      let rafId: number;
      const syncVisibleRange = () => {
        if (isJumping.current) return;
        const headerHeight = getHeaderHeight();
        // Adjust for header
        const scrollTop = Math.max(0, container.scrollTop - headerHeight);

        const start = Math.floor(scrollTop / itemHeight);
        // Ensure we don't calculate beyond total items
        const rawEnd = Math.floor((scrollTop + container.clientHeight) / itemHeight);
        const end = Math.min(totalItemCount - 1, rawEnd);

        handleVisibleRange(start, end, "global");
      };

      const onScroll = () => {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(syncVisibleRange);
      };

      syncVisibleRange();
      container.addEventListener("scroll", onScroll);
      return () => {
        container.removeEventListener("scroll", onScroll);
        cancelAnimationFrame(rafId);
      };
    }, [handleVisibleRange, totalItemCount]);

    // We do NOT need to manually adjust scrollTop when windowOffset changes,
    // because we are using a topSpacer (div) that grows/shrinks exactly matching
    // the height of the removed/added items. The browser and React handles
    // keeping the scroll position stable relative to the document top.
    //
    // Previous inclusion of this logic caused "Double Compensation" which
    // jumped the user down page by page, skipping middle pages.
    useLayoutEffect(() => {
      previousWindowOffset.current = windowOffset;
    }, [windowOffset]);

    useIntersectionSentinel(sentinelRef.current, {
      root: infiniteScrollOptions.root ?? containerRef.current,
      rootMargin: infiniteScrollOptions.rootMargin,
      onVisible: () => {
        void infiniteScrollOptions.onVisible();
      },
    });

    const topSpacer = windowOffset * itemHeight;
    const visibleHeight = items.length * itemHeight;
    const afterSpacer = Math.max(0, totalItemCount * itemHeight - topSpacer - visibleHeight);

    const scrollToGlobalIndex = useCallback((globalIndex: number) => {
      const container = containerRef.current;
      if (!container) return;
      const headerHeight = getHeaderHeight();
      container.scrollTo({ top: globalIndex * itemHeight + headerHeight, behavior: "auto" });
    }, []);

    const handlePageChange = useCallback(
      async (page: number) => {
        isJumping.current = true;
        try {
          const { targetGlobalIndex } = await setPage(page);
          scrollToGlobalIndex(targetGlobalIndex);
          // Allow some time for scroll to settle before re-enabling sync
          setTimeout(() => {
            isJumping.current = false;
          }, 50);
        } catch (e) {
          isJumping.current = false;
        }
      },
      [scrollToGlobalIndex, setPage]
    );

    const renderItem = useCallback(
      (item: { item?: string; isPlaceholder: boolean; globalIndex: number; page: number }) => (
        <div
          key={`item-${item.globalIndex}`}
          style={{
            height: itemHeight,
            borderBottom: "1px solid #eee",
            boxSizing: "border-box", // Ensure strict height
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 12px",
            background: item.isPlaceholder ? "#fafafa" : "white",
            color: item.isPlaceholder ? "#9ca3af" : "#111827",
          }}
          data-page={item.page}
        >
          <span>
            {item.isPlaceholder ? "Loading…" : item.item}
          </span>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Page {item.page}</span>
        </div>
      ),
      []
    );

    return (
      <div style={{ width: 460, border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <h3 style={{ margin: 0, marginBottom: 8 }}>InfinitePaper Demo</h3>
        <p style={{ marginTop: 0, color: "#6b7280", lineHeight: 1.4 }}>
          스크롤을 내려보며 자동 페이지 로딩과 페이지네이션 점프를 함께 체험하세요.
        </p>
        <div
          ref={containerRef}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            height: 540,
            overflowY: "auto",
            overflowAnchor: "none", // Critical: Disable browser scroll anchoring to prevent fighting with manual scroll adjustments
            padding: "0 12px",
            position: "relative",
            background: "white",
          }}
        >
          <div ref={headerRef} style={{ position: "sticky", top: 0, padding: "12px 0", background: "white", zIndex: 1 }}>
            <Pagination items={paginationItems} onPageChange={(page) => void handlePageChange(page)} />
          </div>
          <div style={{ paddingBottom: 12 }}>
            <div style={{ height: topSpacer }} aria-hidden />
            {items.map(renderItem)}
            <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />
            <div style={{ height: afterSpacer }} aria-hidden />
          </div>
        </div>
      </div>
    );
  },
};
