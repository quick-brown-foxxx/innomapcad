import React from 'react';
import { createRoot } from 'react-dom/client';

import { FloatingPanel } from './components/FloatingPanel';
import { PANEL_CSS } from './styles/panel';

/** Maximum time (ms) to wait for the deck.gl overlay element. */
const DECKGL_TIMEOUT_MS = 15_000;

/** Polling interval (ms) for checking if #deckgl-overlay exists. */
const POLL_INTERVAL_MS = 200;

/**
 * Waits for a DOM element matching the given selector to appear.
 * Uses MutationObserver with a polling fallback and a timeout.
 */
function waitForElement(selector: string, timeoutMs: number): Promise<Element> {
  return new Promise<Element>((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing !== null) {
      resolve(existing);
      return;
    }

    let settled = false;

    const settle = (el: Element): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timeoutId);
      clearInterval(pollId);
      resolve(el);
    };

    const fail = (): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearInterval(pollId);
      reject(new Error(`Timed out waiting for "${selector}" after ${String(timeoutMs)}ms`));
    };

    // MutationObserver approach
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el !== null) {
        settle(el);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    // Polling fallback — MutationObserver can miss some framework-driven inserts
    const pollId: ReturnType<typeof setInterval> = setInterval(() => {
      const el = document.querySelector(selector);
      if (el !== null) {
        settle(el);
      }
    }, POLL_INTERVAL_MS);

    const timeoutId: ReturnType<typeof setTimeout> = setTimeout(fail, timeoutMs);
  });
}

/**
 * Creates the shadow DOM host, injects styles, and mounts the React panel.
 */
function mountPanel(): void {
  // Prevent double-mount
  if (document.getElementById('innomapcad-root') !== null) {
    return;
  }

  const host = document.createElement('div');
  host.id = 'innomapcad-root';
  const shadow = host.attachShadow({ mode: 'open' });

  // Inject panel CSS into shadow DOM for style isolation
  const style = document.createElement('style');
  style.textContent = PANEL_CSS;
  shadow.appendChild(style);

  // Create React mount point inside shadow DOM
  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);
  document.body.appendChild(host);

  const root = createRoot(mountPoint);
  root.render(
    <React.StrictMode>
      <FloatingPanel />
    </React.StrictMode>,
  );
}

/**
 * Entry point: waits for deck.gl overlay, then mounts the extension panel.
 */
async function init(): Promise<void> {
  try {
    await waitForElement('#deckgl-overlay', DECKGL_TIMEOUT_MS);
    mountPanel();
  } catch {
    // deck.gl overlay not found within timeout — do not mount
  }
}

void init();
