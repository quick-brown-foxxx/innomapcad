/**
 * Type definitions and TypeIs guard for the deck.gl instance
 * obtained via React fiber walk.
 */

/** Configuration for a single custom layer to inject into deck.gl. */
export interface LayerConfig {
  readonly id: string;
  readonly type: string;
  readonly props: Record<string, unknown>;
}

/** Minimal interface for the deck.gl instance found on the fiber tree. */
export interface DeckInstance {
  setProps: (props: Record<string, unknown>) => void;
}

/**
 * TypeIs guard that narrows `unknown` to `DeckInstance`.
 * This is the single point where we narrow the untyped fiber walk result.
 */
export function isDeckInstance(value: unknown): value is DeckInstance {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value !== 'object') {
    return false;
  }

  return 'setProps' in value && typeof (value as DeckInstance).setProps === 'function';
}
