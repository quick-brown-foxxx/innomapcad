import React from 'react';
import { createRoot } from 'react-dom/client';

import { FloatingPanel } from './components/FloatingPanel';
import { useDeckStore } from './stores/deck-store';
import { PANEL_CSS } from './styles/panel';

import type { LayerConfig } from './bridge/deck-types';

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
 * Injects the page-context script that runs in the page's JS world.
 * This is necessary because the content script runs in an isolated world
 * and cannot access the page's React fiber tree or deck.gl instance.
 */
function injectPageScript(): void {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  script.onload = (): void => {
    script.remove();
  };
  document.head.appendChild(script);
}

/**
 * Listens for the deck-ready event from the injected page script
 * and updates the Zustand store.
 */
function listenForDeckReady(): void {
  document.addEventListener('innomapcad:deck-ready', () => {
    useDeckStore.getState().setDeckReady(true);
  });
}

/**
 * Dispatches custom layer updates to the injected page script
 * whenever the Zustand store changes.
 */
function subscribeToLayerUpdates(): void {
  useDeckStore.subscribe((state, prevState) => {
    if (state.customLayers !== prevState.customLayers) {
      document.dispatchEvent(
        new CustomEvent<readonly LayerConfig[]>('innomapcad:update-layers', {
          detail: state.customLayers,
        }),
      );
    }
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
 * Entry point: waits for deck.gl overlay, injects bridge, then mounts the extension panel.
 */
async function init(): Promise<void> {
  try {
    await waitForElement('#deckgl-overlay', DECKGL_TIMEOUT_MS);

    // Set up bridge communication before injecting
    listenForDeckReady();
    subscribeToLayerUpdates();

    // Inject the page-context script for fiber walk + setProps patching
    injectPageScript();

    // Mount the UI panel
    mountPanel();
  } catch {
    // deck.gl overlay not found within timeout — do not mount
  }
}

void init();
