import { act, renderHook, waitFor } from "@testing-library/react";
import useInfinitePaper from "../index";

const buildItems = (page: number, pageSize: number) =>
  Array.from({ length: pageSize }, (_, idx) => `Item-${page}-${idx}`);

describe("useInfinitePaper", () => {
  it("loads the initial window and exposes pagination data", async () => {
    const fetchPage = vi.fn(async (page: number) => buildItems(page, 3));

    const { result } = renderHook(() =>
      useInfinitePaper<string>({
        pageSize: 3,
        totalPages: 4,
        windowSize: 2,
        fetchPage,
      })
    );

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(result.current.items).toHaveLength(6);
    expect(result.current.hasNextPage).toBe(true);
    expect(
      result.current.paginationItems.find(
        (item) => item.type === "page" && item.page === 1
      )?.isCurrent
    ).toBe(true);
  });

  it("re-centers the window when the visible range shifts", async () => {
    const fetchPage = vi.fn(async (page: number) => buildItems(page, 2));

    const { result } = renderHook(() =>
      useInfinitePaper<string>({
        pageSize: 2,
        totalPages: 5,
        windowSize: 2,
        fetchPage,
      })
    );

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));

    act(() => {
      result.current.handleVisibleRange(2, 3);
    });

    await waitFor(() => expect(result.current.currentPage).toBe(2));
    expect(result.current.maxAccessiblePage).toBeGreaterThanOrEqual(2);
    expect(result.current.pageWindow.startPage).toBe(1);
    expect(result.current.pageWindow.endPage).toBe(2);
  });

  it("advances when the infinite scroll sentinel becomes visible", async () => {
    const fetchPage = vi.fn(async (page: number) => buildItems(page, 4));

    const { result } = renderHook(() =>
      useInfinitePaper<string>({
        pageSize: 4,
        totalPages: 3,
        windowSize: 2,
        fetchPage,
      })
    );

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.isFetching).toBe(false));

    await act(async () => {
      await result.current.infiniteScrollOptions.onVisible();
    });

    await waitFor(() => expect(result.current.currentPage).toBe(2));
    expect(result.current.paginationItems.some((item) => item.page === 2)).toBe(
      true
    );
    expect(result.current.maxAccessiblePage).toBeGreaterThanOrEqual(2);
  });
});
