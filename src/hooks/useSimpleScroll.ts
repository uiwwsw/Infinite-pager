import { useEffect, type RefObject } from "react";

export interface UseSimpleScrollOptions {
    containerRef: RefObject<HTMLElement>;
    itemHeight: number;
    totalItemCount: number;
    handleVisibleRange: (
        visibleStartIndex: number,
        visibleStopIndex: number,
        indexType: "global"
    ) => void;
    headerOffset?: number;
    enabled?: boolean;
}

export function useSimpleScroll({
    containerRef,
    itemHeight,
    totalItemCount,
    handleVisibleRange,
    headerOffset = 0,
    enabled = true,
}: UseSimpleScrollOptions) {
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;

        let rafId: number;

        const syncVisibleRange = () => {
            // If disabled (e.g. during a jump), skip
            if (!enabled) return;

            // Adjust for header
            const scrollTop = Math.max(0, container.scrollTop - headerOffset);

            const start = Math.floor(scrollTop / itemHeight);
            // Ensure we don't calculate beyond total items
            const rawEnd = Math.floor(
                (scrollTop + container.clientHeight) / itemHeight
            );
            const end = Math.min(totalItemCount - 1, rawEnd);

            handleVisibleRange(start, end, "global");
        };

        const onScroll = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(syncVisibleRange);
        };

        // Initial sync
        syncVisibleRange();

        container.addEventListener("scroll", onScroll);
        return () => {
            container.removeEventListener("scroll", onScroll);
            cancelAnimationFrame(rafId);
        };
    }, [
        containerRef,
        enabled,
        handleVisibleRange,
        headerOffset,
        itemHeight,
        totalItemCount,
    ]);
}
