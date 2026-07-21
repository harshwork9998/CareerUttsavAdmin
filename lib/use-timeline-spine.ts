import {
  useCallback,
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";

export type TimelineSpineStyle = {
  top: number;
  height: number;
};

export function useTimelineSpine(
  listRef: RefObject<HTMLElement | null>,
  firstDotRef: RefObject<HTMLElement | null>,
  lastDotRef: RefObject<HTMLElement | null>,
  deps: unknown[] = []
): TimelineSpineStyle | null {
  const [style, setStyle] = useState<TimelineSpineStyle | null>(null);

  const measure = useCallback(() => {
    const list = listRef.current;
    const first = firstDotRef.current;
    const last = lastDotRef.current;

    if (!list || !first || !last) {
      setStyle(null);
      return;
    }

    const listRect = list.getBoundingClientRect();
    const firstRect = first.getBoundingClientRect();
    const lastRect = last.getBoundingClientRect();
    const top = firstRect.top + firstRect.height / 2 - listRect.top;
    const lastCenter = lastRect.top + lastRect.height / 2 - listRect.top;
    const height = lastCenter - top;

    setStyle(height > 0 ? { top, height } : null);
  }, [listRef, firstDotRef, lastDotRef]);

  useLayoutEffect(() => {
    measure();

    const list = listRef.current;
    if (!list) return;

    const observer = new ResizeObserver(measure);
    observer.observe(list);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, ...deps]);

  return style;
}
