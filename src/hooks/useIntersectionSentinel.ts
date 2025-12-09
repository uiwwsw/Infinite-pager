import { useEffect } from "react";

export function useIntersectionSentinel(
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
