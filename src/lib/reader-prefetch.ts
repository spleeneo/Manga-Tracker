export interface ReaderPrefetchPage {
  imageUrl: string;
}

interface ReaderPrefetchResponse {
  status?: string;
  pages?: ReaderPrefetchPage[];
}

interface ReaderPrefetchChapter {
  slug: string;
  chapterId: string;
  signal?: AbortSignal;
}

type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const prefetchedUrls = new Set<string>();
const PREFETCH_CONCURRENCY = 3;
const IMAGE_TIMEOUT_MS = 20_000;

function canPrefetch() {
  return typeof window !== "undefined" && typeof Image !== "undefined";
}

function prefetchImage(url: string, signal?: AbortSignal) {
  if (!canPrefetch() || !url || prefetchedUrls.has(url) || signal?.aborted) {
    return Promise.resolve();
  }

  prefetchedUrls.add(url);

  return new Promise<void>((resolve) => {
    const image = new Image();
    let done = false;

    const cleanup = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      image.onload = null;
      image.onerror = null;
      resolve();
    };

    const abort = () => {
      image.src = "";
      cleanup();
    };

    const timeout = window.setTimeout(cleanup, IMAGE_TIMEOUT_MS);
    signal?.addEventListener("abort", abort, { once: true });
    image.decoding = "async";
    image.loading = "eager";
    image.onload = cleanup;
    image.onerror = cleanup;
    image.src = url;
  });
}

export async function prefetchReaderPages(pages: ReaderPrefetchPage[], signal?: AbortSignal) {
  if (!canPrefetch() || signal?.aborted) return;

  const queue = pages.map((page) => page.imageUrl).filter(Boolean);
  const workers = Array.from({ length: Math.min(PREFETCH_CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0 && !signal?.aborted) {
      const url = queue.shift();
      if (url) await prefetchImage(url, signal);
    }
  });

  await Promise.allSettled(workers);
}

export async function prefetchReaderChapter({ slug, chapterId, signal }: ReaderPrefetchChapter) {
  if (signal?.aborted) return;

  try {
    const res = await fetch(`/api/manga/${slug}/chapter/${chapterId}/reader`, { signal });
    if (!res.ok) return;

    const data = await res.json() as ReaderPrefetchResponse;
    if (data.status !== "READABLE" || !Array.isArray(data.pages)) return;

    await prefetchReaderPages(data.pages, signal);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
  }
}

export function scheduleReaderPrefetch(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  const idleWindow = window as IdleWindow;
  if (typeof idleWindow.requestIdleCallback === "function") {
    const id = idleWindow.requestIdleCallback(callback, { timeout: 2_000 });
    return () => idleWindow.cancelIdleCallback?.(id);
  }

  const id = globalThis.setTimeout(callback, 800);
  return () => globalThis.clearTimeout(id);
}
