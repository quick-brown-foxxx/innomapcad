---
name: managing-state
description: "State management patterns: Zustand stores, React Context, URL state, form state. Use when creating stores, managing component state, or choosing state patterns. ALWAYS load this skill when writing any react code!"
---

# Managing State in React/TypeScript Applications

## Decision Table: When to Use Each Pattern

| Pattern | Use Cases | Examples |
|---------|-----------|---------|
| **Global Zustand Stores** | Business logic, CRUD, domain state | useProductStore, useAuthStore |
| **Atomic Zustand Stores** | Component UI state, local behavior | useProductCardStore, modal state |
| **React Context** | Framework integration, component tree | ThemeProvider, EditionProvider |
| **URL State (nuqs)** | Shareable/bookmarkable state | Pagination, filters, search |
| **Form State (RHF + Zod)** | Complex forms with validation | Auth forms, data entry |
| **React useState** | Simple local UI state (1-2 values) | Toggle, open/close |

### Quick Decision Guide

- Need to share across components? -> Zustand
- Need URL persistence? -> nuqs
- Form with validation? -> React Hook Form + Zod
- Framework/library integration? -> Context
- Simple toggle/local? -> useState
- 3+ related local state pieces? -> Atomic Zustand store

## Global Zustand Store Pattern

This is the primary state management pattern. Every global store follows this complete structure with full type safety and Result-based error handling.

```typescript
import { create } from 'zustand';

import type { ApiResult } from '@/lib/api/api.types';
import type { Result } from '@/lib/result';

// Note: Result<T, E> is defined as:
//   | { readonly success: true; readonly data: T }
//   | { readonly success: false; readonly error: E }

// Store-specific types (define in every store)
type StoreError = Readonly<{
  message: string;
  details?: unknown;
}>;

type StoreResult<T> = Result<T, StoreError>;

type StoreErrorState = Readonly<{
  error: StoreError;
  errorMessageForUser: string;
}>;

// Map ApiResult to StoreResult
function mapApiResultToStoreResult<T>(apiResult: ApiResult<T>): StoreResult<T> {
  if (apiResult.success) {
    return { success: true, data: apiResult.data };
  }
  return {
    success: false,
    error: {
      message: apiResult.error.message,
      details: apiResult.error
    }
  };
}

// Separate State and Actions interfaces (export for testing/reuse)
export interface ItemsState {
  readonly items: readonly Item[];
  readonly loading: boolean;
  readonly error: StoreErrorState | null;
}

export interface ItemsActions {
  fetchItems: () => Promise<StoreResult<readonly Item[]>>;
  createItem: (data: CreateItemDto) => Promise<StoreResult<Item>>;
  clearError: () => void;
}

type ItemsStore = ItemsState & ItemsActions;

export const useItemsStore = create<ItemsStore>(
  (set): ItemsStore => ({
    // State
    items: [],
    loading: false,
    error: null,

    // Actions
    fetchItems: async (): Promise<StoreResult<readonly Item[]>> => {
      set({ loading: true, error: null });
      const apiResult = await itemsApi.getItems();
      const result = mapApiResultToStoreResult(apiResult);

      if (!result.success) {
        set({
          loading: false,
          error: {
            error: result.error,
            errorMessageForUser: 'Failed to load items'
          }
        });
        return result;
      }

      set({ items: result.data, loading: false });
      return result;
    },

    createItem: async (data: CreateItemDto): Promise<StoreResult<Item>> => {
      set({ loading: true, error: null });
      const apiResult = await itemsApi.createItem(data);
      const result = mapApiResultToStoreResult(apiResult);

      if (!result.success) {
        set({
          loading: false,
          error: {
            error: result.error,
            errorMessageForUser: 'Failed to create item'
          }
        });
        return result;
      }

      set((state) => ({
        items: [...state.items, result.data],
        loading: false
      }));
      return result;
    },

    clearError: (): void => {
      set({ error: null });
    }
  })
);
```

## Store Rules

1. **Global stores** handle domain state, business logic, and consume API clients.
2. **Atomic stores** handle component UI state and local behavior.
3. **Business logic lives in store methods**, NOT in components.
4. Store actions return `StoreResult<T>` so components can react to success/failure.
5. Map `ApiResult` to `StoreResult` with `mapApiResultToStoreResult()`.
6. Include user-friendly `errorMessageForUser` in error state.
7. Separate `State` and `Actions` interfaces (exported), combine as `Store = State & Actions`.
8. Annotate the `create` callback return type: `(set): MyStore => ({...})`.
9. Use explicit return types on all action methods (e.g., `(): void => { ... }`).

## Store Composition and Dependencies

```
Layer 1: Global Domain Stores (data + business logic)
  useProductsStore, useCartStore

Layer 2: Atomic Component Stores (UI state + local behavior)
  useProductCardStore, useCartWidgetStore

Layer 3: Cross-cutting Stores (framework concerns)
  useNotificationStore, useUIStore
```

### Dependency Rules

- **OK:** Global stores are singletons, created once.
- **OK:** Atomic stores inject global store dependencies.
- **OK:** Communication: Atomic -> Global (delegate), Global -> Atomic (subscribe).
- **OK:** Dependency injection via factory pattern prevents circular dependencies.
- **NEVER:** Atomic -> Atomic direct communication (use Global as mediator).
- **NEVER:** Global -> Atomic imports (circular dependency).

## React Context Pattern

Use ONLY for framework integration and component tree configuration, NOT for business state.

```typescript
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface ThemeContextType {
  activeTheme: string;
  setActiveTheme: (theme: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [activeTheme, setActiveTheme] = useState<string>(DEFAULT_THEME);

  return (
    <ThemeContext.Provider value={{ activeTheme, setActiveTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
```

## URL State with nuqs

Use for pagination, sorting, filtering, search -- anything that should be shareable via URL.

```typescript
import { useQueryState, parseAsInteger } from 'nuqs';

const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
const [search, setSearch] = useQueryState('q', { defaultValue: '' });
```

## Form State with React Hook Form and Zod

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Min 8 characters')
});

type FormData = z.infer<typeof schema>;

const form = useForm<FormData>({
  resolver: zodResolver(schema),
  mode: 'onChange'
});
```

### Key Form Patterns

- **Schema-first:** Define the Zod schema, then infer the TypeScript type with `z.infer`.
- **Server error mapping:** Map server validation errors back to individual form fields.
- **`mode: 'onChange'`** for instant feedback as the user types.

## Data Flow

```
Component -> Zustand Store -> API Client -> Backend
                ↓
      Store Updates -> Component Re-renders
```

Components call `store.action()` -> store calls API -> wraps in Result -> updates state -> component re-renders.

## Anti-patterns

- **Using React Context for frequently changing state.** Context changes re-render the entire tree below the provider.
- **Putting business logic in components.** Move it to store actions where it can be tested and reused.
- **Calling API directly from components.** Always go through a store so state stays consistent.
- **Using useState for state shared between components.** Use Zustand instead.
- **Atomic stores communicating directly with each other.** Use a global store as a mediator.
