/**
 * Background service worker that proxies fetch requests from content scripts.
 *
 * Content scripts run under the page's origin (https://www.4dinno.ru), so
 * Chrome's Private Network Access policy blocks requests to localhost.
 * The background service worker runs in extension context, which CAN access
 * localhost. This listener proxies those requests.
 */

/** Message sent from content script to request a proxied fetch. */
interface ProxyRequest {
  readonly type: 'PROXY_FETCH';
  readonly url: string;
  readonly options?: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly body?: string;
  };
}

/** Response returned to the content script. */
interface ProxyResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly data: unknown;
  readonly error?: string;
}

function isProxyRequest(message: unknown): message is ProxyRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    (message as { type: unknown }).type === 'PROXY_FETCH'
  );
}

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ProxyResponse) => void,
  ): boolean | undefined => {
    if (!isProxyRequest(message)) {
      return undefined;
    }

    void fetch(message.url, message.options)
      .then(async (response) => {
        const data: unknown = await response.json();
        return { ok: response.ok, status: response.status, data };
      })
      .then((result) => {
        sendResponse(result);
      })
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          status: 0,
          data: null,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    // Return true to keep the message channel open for async sendResponse
    return true;
  },
);
