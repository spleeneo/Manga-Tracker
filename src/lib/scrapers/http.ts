export type ScraperErrorKind = "network" | "rate_limit" | "parsing" | "blocked" | "http";

export class ScraperRequestError extends Error {
  constructor(
    message: string,
    public kind: ScraperErrorKind,
    public status?: number,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ScraperRequestError";
  }
}

interface RetryFetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyStatus(status: number): ScraperErrorKind {
  if (status === 429) return "rate_limit";
  if (status === 401 || status === 403) return "blocked";
  return "http";
}

export async function fetchWithRetry(url: string, options: RetryFetchOptions = {}) {
  const {
    timeoutMs = 12_000,
    retries = 2,
    retryDelayMs = 800,
    ...requestOptions
  } = options;

  let attempt = 0;
  let lastError: Error | undefined;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...requestOptions,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const kind = classifyStatus(response.status);
        const error = new ScraperRequestError(
          `Scraper request failed with status ${response.status}`,
          kind,
          response.status
        );

        if (attempt < retries && (response.status >= 500 || response.status === 429)) {
          attempt++;
          await delay(retryDelayMs * attempt);
          continue;
        }

        throw error;
      }

      return response;
    } catch (error) {
      clearTimeout(timeout);

      const isAbort = error instanceof Error && error.name === "AbortError";
      const wrapped = isAbort
        ? new ScraperRequestError("Scraper request timed out", "network", undefined, { cause: error })
        : error instanceof ScraperRequestError
          ? error
          : new ScraperRequestError("Scraper network request failed", "network", undefined, { cause: error as Error });

      lastError = wrapped;
      if (attempt >= retries) break;
      attempt++;
      await delay(retryDelayMs * attempt);
    }
  }

  throw lastError ?? new ScraperRequestError("Unknown scraper request failure", "network");
}
