import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useRef } from "react";
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
    const headerRef = useRef<HTMLDivElement>(null);
    const HEADER_HEIGHT_ESTIMATE = 60;

    const fetchPage = useCallback(async (page: number) => {
      // 인디케이터가 보일 수 있도록 약간의 지연을 추가합니다.
      await new Promise((resolve) => setTimeout(resolve, 250));
      return buildPageItems(page, pageSize);
    }, [pageSize]);

    // With the new API, we just pass itemHeight and headerOffset!
    const {
      items,
      paginationItems,
      setPage,
      pageSize: resolvedPageSize,
      totalPages: resolvedTotalPages,
      windowOffset,
      containerRef: hookContainerRef, // The hook provides the ref now!
      sentinelRef: hookSentinelRef,   // The hook provides the ref now!
    } = useInfinitePaper<string>({
      pageSize,
      totalPages,
      windowSize,
      fetchPage,
      rootMargin,
      itemHeight,
      headerOffset: HEADER_HEIGHT_ESTIMATE,
    });

    const totalItemCount = resolvedTotalPages * resolvedPageSize;
    // We can still use our own ref if we want, or use the one from the hook.
    // Let's use the one from the hook for the container.
    // But for the header, we still need our own ref to measure it if we wanted dynamic measurement.

    // Note: The hook takes a static number for headerOffset currently. 
    // If dynamic header height is critical, useSimpleScroll (advanced usage) is better.
    // But for "Easy Mode", a static offset is usually fine.

    const topSpacer = windowOffset * itemHeight;
    const visibleHeight = items.length * itemHeight;
    const afterSpacer = Math.max(0, totalItemCount * itemHeight - topSpacer - visibleHeight);

    const scrollToGlobalIndex = useCallback((globalIndex: number) => {
      const container = hookContainerRef.current;
      if (!container) return;
      container.scrollTo({ top: globalIndex * itemHeight + HEADER_HEIGHT_ESTIMATE, behavior: "auto" });
    }, [hookContainerRef]);

    const handlePageChange = useCallback(
      async (page: number) => {
        try {
          const { targetGlobalIndex } = await setPage(page);
          scrollToGlobalIndex(targetGlobalIndex);
        } catch (e) {
          // ignore
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
          ref={hookContainerRef}
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
            <div ref={hookSentinelRef} style={{ height: 1 }} aria-hidden />
            <div style={{ height: afterSpacer }} aria-hidden />
          </div>
        </div>
      </div>
    );
  },
};
