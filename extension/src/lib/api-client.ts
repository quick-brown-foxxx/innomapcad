import { err, ok } from '@/lib/result';

import type { Result } from '@/lib/result';
import type { ZodType } from 'zod';

/** Error shape returned by all API operations. */
export interface ApiError {
  readonly message: string;
  readonly status?: number;
}

/**
 * Generic fetch wrapper that validates the response body against a Zod schema.
 *
 * - Network / JSON-parse failures are caught and returned as `Result` errors.
 * - HTTP error status codes produce an error with the status attached.
 * - A successful HTTP response whose body fails Zod validation produces a
 *   `VALIDATION_ERROR` message with the Zod issue details.
 */
export async function apiFetch<T>(
  url: string,
  schema: ZodType<T>,
  init?: RequestInit,
): Promise<Result<T, ApiError>> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error: unknown) {
    return err({
      message:
        error instanceof Error
          ? error.message
          : 'Network request failed',
    });
  }

  if (!response.ok) {
    return err({
      message: `HTTP ${String(response.status)}: ${response.statusText}`,
      status: response.status,
    });
  }

  let json: unknown;
  try {
    json = await response.json() as unknown;
  } catch {
    return err({
      message: 'Failed to parse response JSON',
      status: response.status,
    });
  }

  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    return err({
      message: `Response validation failed: ${parsed.error.message}`,
      status: response.status,
    });
  }

  return ok(parsed.data);
}
