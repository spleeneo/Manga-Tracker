"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Local, opt-in measurements only. No analytics service or data transmission.
export function PerformanceDiagnostics() {
  const pathname = usePathname();
  const [report, setReport] = useState("");
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_PERF_DIAGNOSTICS !== "1") return;
    const startedAt = performance.now();
    let cls = 0;
    let libraryReadyMs: number | null = null;
    let firstReaderImageMs: number | null = null;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput && shift.startTime >= startedAt) cls += shift.value;
      }
    });
    try { observer.observe({ type: "layout-shift", buffered: true }); } catch { /* Unsupported browser. */ }
    const timer = window.setInterval(() => {
      if (libraryReadyMs === null && document.querySelector("[data-library-ready]")) libraryReadyMs = Math.round(performance.now() - startedAt);
      const image = document.querySelector<HTMLImageElement>("img[data-reader-page-index='0']");
      if (firstReaderImageMs === null && image?.complete && image.naturalWidth > 0) firstReaderImageMs = Math.round(performance.now() - startedAt);
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      setReport(JSON.stringify({ pathname, elapsedMs: Math.round(performance.now() - startedAt), libraryReadyMs, firstReaderImageMs, cls: Number(cls.toFixed(4)), heapBytes: memory?.usedJSHeapSize ?? null, readerImages: document.querySelectorAll("img[data-reader-page-index]").length, readerSections: document.querySelectorAll("[data-reader-chapter-id]").length }));
    }, 100);
    return () => { window.clearInterval(timer); observer.disconnect(); };
  }, [pathname]);
  return process.env.NEXT_PUBLIC_PERF_DIAGNOSTICS === "1" ? <output data-performance-diagnostics hidden>{report}</output> : null;
}
