---
name: testing-react-ts
description: "React/TypeScript testing with Vitest and Playwright: philosophy, component tests, integration tests, e2e tests, test infrastructure. Use when writing tests or setting up test infrastructure. ALWAYS load this for working with tests in react."
---

# React/TypeScript Testing

## 1. Philosophy

### Core Principles

- **Trustworthiness > coverage** — A small suite you trust beats a large suite full of false confidence. Every test should catch a real bug if one existed.
- **5 good Playwright e2e tests > 100 component tests with heavy mocking** — End-to-end tests exercise the real system. Component tests with mocked-out everything prove very little.
- **Pareto principle** — Write the fewest tests that cover 80% of what matters. Focus on critical user paths and known-fragile areas.
- **Component tests for interaction logic** — Use component tests where they shine: verifying that clicks, keyboard input, and conditional rendering work correctly.
- **Real over mocked** — MSW over module mocks. Rendered over shallow. Real stores over fake ones. The closer a test is to production, the more it proves.
- **Test behavior, not implementation** — Assert what the user sees and experiences, not internal state, CSS classes, or component structure.

---

## 2. Testing Pyramid

| Level | Tool | Location | Purpose |
|---|---|---|---|
| Component tests | Vitest + RTL | `src/**/__tests__/*.test.tsx` | Component rendering, interactions |
| Integration tests | Vitest + MSW | `src/**/*.integration.test.tsx` | Feature workflows, store + API |
| E2e tests | Playwright | `src/test/ui/*.spec.ts` | Full user journeys |

### Commands

```bash
pnpm test:unit              # Run all Vitest tests
pnpm test:ui:headless       # Run Playwright tests headless
pnpm test:all               # Run both Vitest and Playwright
pnpm test:unit --watch      # TDD mode — re-runs on file change
```

---

## 3. Test Planning

Before writing any test code, plan first. This prevents wasted effort and ensures coverage of what matters.

1. **List all potential test cases** for the feature or component
2. **Categorize each case** as critical, medium, or small importance
3. **Discard small-importance cases** — they cost time without meaningful protection
4. **Write remaining cases in plain text first** — describe expected behavior in sentences
5. **Then write test code** — translate the plain-text cases into executable tests

Example planning output:

```
Feature: Login form

Critical:
- Submits credentials and redirects to dashboard on success
- Displays server error message on 401
- Displays field-level errors from API validation response

Medium:
- Disables submit button while request is in flight
- Shows loading spinner during submission

Discarded (small):
- Input field focus styles
- Placeholder text content
```

---

## 4. Component Tests (Vitest + React Testing Library)

```tsx
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { Button } from '../button';

describe('Button', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click me</Button>);
    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('can be disabled', () => {
    render(<Button disabled>Disabled button</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

**Note:** Always call `userEvent.setup()` at the top of the test, then use `user.click()`, `user.type()`, etc. Do not call `userEvent.click()` directly — the setup pattern enables proper event sequencing.

### Key Practices

- **Use custom render from `test-utils`** — it wraps components with all necessary providers (theme, router, store). Never call `@testing-library/react`'s `render` directly.
- **Semantic queries first** — `getByRole`, `getByLabelText`, `getByText`. These reflect what users and assistive technology see. Avoid `getByTestId` unless no semantic alternative exists.
- **`userEvent` over `fireEvent`** — `userEvent` simulates realistic browser interactions (focus, hover, keystrokes). `fireEvent` dispatches synthetic events that skip browser behavior.
- **Test user-visible behavior** — Assert on rendered text, ARIA roles, visibility, and navigation. Do not assert on internal state, hook return values, or CSS classes.
- **One concept per test** — Each `it` block should test a single behavior. If a test needs a long description, it is testing too much.

### Query Priority

| Priority | Query | When to use |
|---|---|---|
| 1 | `getByRole` | Buttons, headings, links, form controls |
| 2 | `getByLabelText` | Form inputs with associated labels |
| 3 | `getByPlaceholderText` | Inputs without visible labels (rare) |
| 4 | `getByText` | Non-interactive content |
| 5 | `getByTestId` | Last resort — no semantic alternative |

### Async Patterns

```tsx
// Wait for element to appear after async operation
await screen.findByText('Success');

// Wait for element to disappear
await waitForElementToBeRemoved(() => screen.queryByText('Loading...'));

// Assert element is NOT present (use query, not get)
expect(screen.queryByText('Error')).not.toBeInTheDocument();
```

---

## 5. Test Utilities Setup

```tsx
// src/test/test-utils.tsx
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      forcedTheme="dark"
      enableSystem={false}
    >
      {children}
    </ThemeProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything from RTL, override render
export * from '@testing-library/react';
export { customRender as render };
```

### Key Details

- **`Omit<RenderOptions, 'wrapper'>`** — prevents callers from accidentally overriding the wrapper.
- **`export *`** — re-exports `screen`, `waitFor`, `fireEvent`, etc. so tests only need one import: `import { render, screen } from '@/test/test-utils'`.
- **Adding providers** — when the app adds new context providers, update `AllTheProviders`. All component tests inherit the change automatically.

### Setup File (`src/test/setup.ts`)

The setup file runs before every test. It handles:

1. **Environment variables** — set `process.env` values before any imports so t3-env validation passes
2. **Jest-DOM matchers** — `import '@testing-library/jest-dom'` adds `.toBeInTheDocument()`, `.toBeVisible()`, etc.
3. **Next.js mocks** — `vi.mock('next/navigation')`, `vi.mock('next/link')`, `vi.mock('next/image')` since these rely on Next.js internals unavailable in jsdom
4. **Browser API polyfills** — `matchMedia`, `IntersectionObserver`, `ResizeObserver` for components that use them
5. **Auth store mocks** — pre-configured authenticated state for component tests

### Vitest Configuration

```ts
// vitest.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,                          // vi, describe, it, expect available globally
    exclude: ['**/node_modules/**', '**/ui/**'],  // Exclude Playwright tests
    env: {
      NEXT_PUBLIC_API_URL: 'http://localhost:3001',
      NEXT_PUBLIC_TEST_MODE: 'true',
      NODE_ENV: 'test'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')   // Match Next.js path alias
    }
  }
});
```

Key points:
- **`globals: true`** — makes `vi`, `describe`, `it`, `expect` available without imports. Tests can still explicitly import from `vitest` if preferred.
- **`exclude: ['**/ui/**']`** — prevents Vitest from picking up Playwright spec files.
- **`@` alias** — matches the Next.js `@/` path alias so imports like `@/test/test-utils` resolve correctly.

---

## 6. Store Testing

Stores are tested by calling actions and checking resulting state. Use real store instances, not mocks.

```tsx
import { http, HttpResponse } from 'msw';
import { useItemStore } from '@/stores/item-store';

// Reset store to a known initial state before each test
const initialState = { data: null, loading: false, error: null };

describe('itemStore', () => {
  beforeEach(() => {
    useItemStore.setState(initialState);
  });

  it('fetches items successfully', async () => {
    // MSW handler returns mock data at network level
    await useItemStore.getState().fetchItems();

    const state = useItemStore.getState();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.data).toHaveLength(3);
  });

  it('handles API failure with Result pattern', async () => {
    // Override the default MSW handler for this test
    server.use(
      http.get('/api/items', () =>
        HttpResponse.json({ message: 'Server error' }, { status: 500 })
      )
    );

    await useItemStore.getState().fetchItems();

    const state = useItemStore.getState();
    expect(state.loading).toBe(false);
    expect(state.error).not.toBeNull();
    expect(state.data).toBeNull();
  });
});
```

### Rules

- **Reset store state** in `beforeEach` to prevent test pollution
- **Use MSW** to intercept network requests — this tests the real fetch, validation, and store flow
- **Verify both success and error paths** — the Result pattern means both branches must be covered
- **Do not mock the store itself** — test the real implementation

---

## 7. E2E Tests (Playwright)

```ts
import { test, expect } from '@playwright/test';

test('should display dashboard layout when authenticated', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/.*\/dashboard\/hello-world$/);

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const sidebarToggle = page.getByRole('button', { name: /toggle sidebar/i });
  await expect(sidebarToggle).toBeVisible();
  await sidebarToggle.click();
  await expect(sidebarToggle).toBeVisible();
});
```

### Playwright Projects Architecture

The config defines three Playwright projects that control authentication state:

| Project | `testMatch` pattern | Auth state | Purpose |
|---|---|---|---|
| `global setup` | `global.setup.ts` | Creates auth cookies, saves `storageState` | Runs first |
| `authenticated` | `*authenticated*.spec.ts` | Uses saved `storageState` | Dashboard, protected pages |
| `auth-less` | `*.spec.ts` (excluding `authenticated`) | No stored state | Public pages, login flow |

```
src/test/ui/
├── global.setup.ts                           # Sets auth cookies, saves storageState
├── utils/                                    # Shared test utilities (e.g., hydration checker)
├── dashboard.authenticated.spec.ts           # Authenticated: dashboard tests
├── dashboard.routing.authenticated.spec.ts   # Authenticated: routing tests
├── public-pages.spec.ts                      # Auth-less: public page tests
└── ui-quality.spec.ts                        # Auth-less: accessibility, visual checks
```

- **`global.setup.ts`** runs before all other projects. It sets authentication cookies and saves browser `storageState` to `.test-data/mock-auth/user.json`. Both `authenticated` and `auth-less` projects depend on `global setup`.
- **`*.authenticated.spec.ts`** files automatically load the saved `storageState`, so each test starts with an authenticated session.
- **Other `*.spec.ts`** files run without stored auth state, testing public-facing pages and login flows.
- **`webServer`** config builds the Next.js app and starts it on a test port (`pnpm build && PORT=3100 pnpm start`).

### Playwright Best Practices

- **Use locators, not selectors** — `page.getByRole('button', { name: 'Submit' })` over `page.locator('.submit-btn')`
- **Auto-waiting** — Playwright waits for elements automatically. Do not add manual `waitForTimeout` calls.
- **Assertions with `expect`** — Use Playwright's `expect` (not Vitest's). It has built-in retrying: `await expect(page.getByText('Done')).toBeVisible()`.
- **Isolate tests** — Each test should be independent. Do not rely on state from a previous test.

---

## 8. Mocking Strategy

### Preferred: MSW (Mock Service Worker)

MSW intercepts requests at the network level. This means your code's real `fetch` calls, Zod validation, and store logic all execute — only the server response is faked.

```tsx
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

Override handlers per-test for error scenarios:

```tsx
it('shows error state on API failure', async () => {
  server.use(
    http.get('/api/users', () => {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    })
  );

  render(<UserList />);
  await screen.findByText('Not found');
});
```

### Acceptable: Direct store state or hook mocks

For isolated component tests where you only care about rendering logic, pre-setting store state is acceptable:

```tsx
useUserStore.setState({ data: mockUser, loading: false, error: null });
render(<UserProfile />);
```

For components that depend on hooks returning specific data, mock the hook module and use `vi.mocked()`:

```tsx
vi.mock('@/hooks/use-current-page', () => ({
  useCurrentPage: vi.fn()
}));

import { useCurrentPage } from '@/hooks/use-current-page';

beforeEach(() => {
  vi.mocked(useCurrentPage).mockReturnValue({
    title: 'Dashboard',
    url: '/dashboard',
    icon: 'dashboard'
  });
});
```

This is acceptable when the hook returns derived/contextual data. Avoid this for hooks that perform side effects or API calls — use MSW instead.

### Avoid

| Pattern | Why |
|---|---|
| Mocking internal modules (`vi.mock('./utils')`) | Couples tests to file structure; breaks on refactors |
| Shallow rendering | Tests nothing meaningful; misses integration bugs |
| Mocking React hooks (`vi.mock('react', ...)`) | Fragile, tests implementation, not behavior |
| Mocking the store's action implementations | Defeats the purpose of testing the store flow |

---

## 9. File Organization

```
src/test/
├── setup.ts                              # Global config: env vars, Next.js mocks, browser polyfills
├── test-utils.tsx                        # Custom render with all providers
└── ui/                                   # Playwright tests
    ├── global.setup.ts                   #   Auth state creation (cookies + storageState)
    ├── utils/                            #   Shared Playwright utilities
    ├── dashboard.authenticated.spec.ts   #   Authenticated user journeys
    ├── public-pages.spec.ts              #   Public page tests (no auth)
    └── ui-quality.spec.ts                #   Accessibility and visual checks

src/{feature}/__tests__/
├── FeatureComponent.test.tsx             # Component test
└── feature.integration.test.tsx          # Integration test (store + API via MSW)
```

### Naming Conventions

| File type | Pattern | Example |
|---|---|---|
| Component test | `ComponentName.test.tsx` | `LoginForm.test.tsx` |
| Integration test | `feature.integration.test.tsx` | `auth.integration.test.tsx` |
| E2e test (authenticated) | `feature.authenticated.spec.ts` | `dashboard.authenticated.spec.ts` |
| E2e test (public) | `feature.spec.ts` | `public-pages.spec.ts`, `ui-quality.spec.ts` |
| Test utilities | `test-utils.tsx` | `src/test/test-utils.tsx` |

---

## 10. Test Validation Checklist

Before committing tests, verify every item:

- [ ] **Tests are meaningful** — each test would catch a real bug if one were introduced
- [ ] **Tests don't compromise source code** — no `export` added solely for testing; no `data-testid` added when a semantic query works
- [ ] **Error paths are tested** — not just happy paths; Result error branches, network failures, validation errors
- [ ] **Async operations properly awaited** — no floating promises; use `await` on `userEvent`, `findBy` queries, and store actions
- [ ] **No implementation details tested** — no assertions on internal state, CSS classes, component instance methods, or hook return values
- [ ] **Tests are independent** — each test can run in isolation; `beforeEach` resets shared state
- [ ] **No test-only code in production** — no `if (process.env.NODE_ENV === 'test')` branches in source code
