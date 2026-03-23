import { err, ok } from '@/lib/result';

import type { Result } from '@/lib/result';
import type { ZodType } from 'zod';

/** Error shape returned by all API operations. */
export interface ApiError {
  readonly message: string;
  readonly status?: number;
}

/** Response shape from the background service worker proxy. */
interface ProxyResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly data: unknown;
  readonly error?: string;
}

/**
 * Send a fetch request through the background service worker.
 *
 * Content scripts run under the page's origin, so Chrome's Private Network
 * Access policy blocks direct requests to localhost. The background service
 * worker runs in extension context and CAN reach localhost.
 */
async function proxyFetch(
  url: string,
  init?: RequestInit,
): Promise<Result<ProxyResponse, ApiError>> {
  const options = init
    ? {
        method: init.method,
        headers: init.headers as Record<string, string> | undefined,
        body: typeof init.body === 'string' ? init.body : undefined,
      }
    : undefined;

  try {
    const response: ProxyResponse = await chrome.runtime.sendMessage({
      type: 'PROXY_FETCH',
      url,
      options,
    });

    return ok(response);
  } catch (error: unknown) {
    return err({
      message:
        error instanceof Error
          ? error.message
          : 'Background proxy request failed',
    });
  }
}

/**
 * Generic fetch wrapper that validates the response body against a Zod schema.
 *
 * Requests are proxied through the background service worker so that content
 * scripts can reach localhost (bypassing Private Network Access restrictions).
 *
 * - Network / proxy failures are caught and returned as `Result` errors.
 * - HTTP error status codes produce an error with the status attached.
 * - A successful HTTP response whose body fails Zod validation produces a
 *   `VALIDATION_ERROR` message with the Zod issue details.
 */
export async function apiFetch<T>(
  url: string,
  schema: ZodType<T>,
  init?: RequestInit,
): Promise<Result<T, ApiError>> {
  const proxyResult = await proxyFetch(url, init);

  if (!proxyResult.ok) {
    return proxyResult;
  }

  const response = proxyResult.value;

  if (response.error !== undefined) {
    return err({
      message: response.error,
    });
  }

  if (!response.ok) {
    return err({
      message: `HTTP ${String(response.status)}`,
      status: response.status,
    });
  }

  const parsed = schema.safeParse(response.data);

  if (!parsed.success) {
    return err({
      message: `Response validation failed: ${parsed.error.message}`,
      status: response.status,
    });
  }

  return ok(parsed.data);
}
