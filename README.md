# @uiwwsw/infinitePaper

A headless React helper that marries infinite scroll and numbered pagination without keeping the entire dataset in memory. It maintains a sliding window of contiguous pages, fetches only what is needed, and exposes helpers you can plug into any virtualized list (e.g. `react-window`, `react-virtual`).

## Features

- **Contiguous page window**: keeps a limited, gap-free range of pages in memory so you never render disjoint data (e.g. page 5 next to page 99).
- **Jump without over-fetching**: `scrollToPage` recenters the window around the target page instead of loading everything in between.
- **Viewport-aware**: `handleVisibleRange` converts virtual list indices into the current page and shifts the window when you approach the edges.
- **Placeholder-friendly**: exposes `isPlaceholder` on each item so you can render skeleton rows while the page is loading.
- **Built-in pagination UI**: includes a lightweight `Pagination` component wired to the hook's pagination data.

## Installation

```bash
npm install @uiwwsw/infinitePaper
```

Peer dependency: React 17+.

## Quick start

```tsx
import { FixedSizeList } from "react-window";
import useInfinitePaper, { Pagination } from "@uiwwsw/infinitePaper";

function Example() {
  const pageSize = 20;

  const infinite = useInfinitePaper({
    pageSize,
    totalPages: 120,
    windowSize: 10,
    initialPage: 1,
    fetchPage: async (page) => {
      const res = await fetch(`/items?page=${page}&pageSize=${pageSize}`);
      const data = await res.json();
      return data.items; // must match pageSize length
    },
    onPageChange: (page) => console.log("now on page", page),
  });

  return (
    <div>
      <button onClick={() => infinite.scrollToPage(100)}>Jump to 100</button>
      <FixedSizeList
        height={520}
        itemCount={infinite.items.length}
        itemSize={52}
        onItemsRendered={({ visibleStartIndex, visibleStopIndex }) =>
          infinite.handleVisibleRange(visibleStartIndex, visibleStopIndex)
        }
      >
        {({ index, style }) => {
          const row = infinite.items[index];
          return (
            <div style={style}>
              {row.isPlaceholder ? "Loading…" : `#${row.globalIndex + 1}: ${row.item}`}
            </div>
          );
        }}
      </FixedSizeList>

      <Pagination
        items={infinite.paginationItems}
        onPageChange={(page) => infinite.scrollToPage(page)}
      />
    </div>
  );
}
```

### Implementing pagination buttons

```tsx
function Pager({ infinite }: { infinite: ReturnType<typeof useInfinitePaper<any>> }) {
  return (
    <div>
      <button onClick={() => infinite.scrollToPage(Math.max(1, infinite.currentPage - 1))}>
        Prev
      </button>
      <span>
        {infinite.currentPage} / {infinite.totalPages}
      </span>
      <button
        onClick={() => infinite.scrollToPage(Math.min(infinite.totalPages, infinite.currentPage + 1))}
      >
        Next
      </button>
    </div>
  );
}
```

### Amazon-style pagination data

`useInfinitePaper` keeps track of the highest page the user has actually scrolled to.
The `paginationItems` field exposes a list of Amazon-like pagination controls that
only become clickable after the user has visited them through scrolling. This
prevents showing deep links like “1000” before the user has progressed that far
in the scroll experience.

```tsx
function AmazonPager({ infinite }: { infinite: ReturnType<typeof useInfinitePaper<any>> }) {
  return (
    <nav aria-label="Pagination">
      {infinite.paginationItems.map((item, index) => {
        if (item.type === "ellipsis") return <span key={index}>…</span>;
        return (
          <button
            key={index}
            disabled={item.disabled}
            aria-current={item.isCurrent || undefined}
            onClick={() => item.page && infinite.scrollToPage(item.page)}
          >
            {item.type === "prev" && "Prev"}
            {item.type === "next" && "Next"}
            {item.type === "page" && item.page}
          </button>
        );
      })}
    </nav>
  );
}
```

### Key concepts

- **Window size**: `windowSize` controls how many pages stay in memory at once. The window always remains contiguous.
- **Window offset**: `windowOffset` tells you the global index of the first item in the window. Use it if you need to align external scroll positions.
- **Visible range callback**: `handleVisibleRange` translates the visible indices into a page number, triggers `onPageChange`, and recenters the window when you scroll near its edges. It accepts either indices relative to the current window _or_ absolute indices from virtualizers configured with the total item count.
- **Jumping**: `scrollToPage(page)` recenters around `page` and returns the global index for that page so you can `scrollToItem` in your virtual list.

## API

`useInfinitePaper<T>(options)` returns:

- `items: PaperItem<T>[]` – flattened items for the current window. Each item includes `page`, `indexInPage`, `globalIndex`, `item`, and `isPlaceholder`.
- `pageWindow: { startPage; endPage }` – the inclusive range kept in memory.
- `currentPage: number` – derived from viewport callbacks or direct jumps.
- `windowOffset: number` – global index of the first item in the window.
- `isFetching: boolean` – true while any page in the window is loading.
- `pages: Map<number, PageRecord<T>>` – raw page states (status, items, error).
- `scrollToPage(page)` – recenters the window; returns `{ targetGlobalIndex }`.
- `handleVisibleRange(start, stop)` – feed this the visible item indices from your virtual list.
- `setPage(page)` / `goToNextPage()` – convenience wrappers around `scrollToPage` for button or keyboard handlers.
- `onVisibleBottom()` – helper you can pass to an infinite scroll sentinel; uses the pagination rules in this hook.
- `hasNextPage` – whether another page exists beyond `currentPage`.
- `infiniteScrollOptions` – `{ onVisible, root, rootMargin }` prepared for an `IntersectionObserver` sentinel.
- `reloadPage(page)` – marks a page as idle so it refetches next render cycle.
- `pageSize` and `totalPages` – echoed for convenience.

`PageRecord` statuses: `"idle" | "loading" | "loaded" | "error"`.

## Design notes

- Keeps only contiguous pages in memory to avoid “page 5 + page 99” discontinuities.
- Prefetches when you approach the current window edges (configurable via `prefetchThresholdPages`).
- Exposes placeholders so you can render skeletons while remote data loads.
- Works with any virtual list; you control the DOM and scrolling strategy.

## License

MIT
