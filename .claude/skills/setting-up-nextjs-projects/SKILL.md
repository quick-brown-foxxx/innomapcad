---
name: setting-up-nextjs-projects
description: "Next.js project setup: directory structure, configuration, tooling, environment validation. Use when bootstrapping new projects or understanding project layout."
---

# Setting Up Next.js Projects

New projects start from the template with the full safety net pre-configured: strict TypeScript, ESLint with type-checked rules, Prettier with Tailwind sorting, environment validation, and test infrastructure.

---

## 1. Project Layout

```
src/
├── app/                    # Next.js App Router (routes, layouts, metadata)
│   ├── auth/               # Auth pages
│   ├── dashboard/          # Feature routes
│   └── layout.tsx          # Root layout with providers
├── assets/
│   └── icons/              # Figma-exported SVG icons
├── components/
│   ├── layout/             # App shell, sidebar, header, page containers
│   └── ui/                 # shadcn/ui primitives (copy-paste, own the code)
├── hooks/                  # Custom React hooks
├── lib/
│   ├── api/                # HTTP client, types, validation, error handling
│   ├── base-path.ts        # Base path utilities for deployment
│   ├── font.ts             # Font configuration
│   ├── format.ts           # Formatting helpers
│   ├── result.ts           # Result pattern
│   └── utils.ts            # General utilities (cn, etc.)
├── features/               # Feature modules (auth, etc.)
│   └── {feature}/
│       ├── components/
│       ├── stores/
│       ├── api/
│       └── types/
├── mfes/                   # Micro-frontend apps (optional)
│   ├── config.ts           # MFE registry
│   ├── config.editions.ts  # Edition definitions
│   ├── lib/                # Runtime helpers
│   ├── shared/             # Shared MFE components
│   └── {mfe-name}/         # Individual MFE
├── test/                   # Test infrastructure
│   ├── setup.ts
│   ├── test-utils.tsx
│   └── ui/                 # Playwright tests
├── types/                  # Shared TypeScript types
├── env.ts                  # Environment validation (t3-env)
├── middleware.ts            # Next.js middleware (auth, redirects)
├── instrumentation.ts      # Server-side instrumentation (Sentry)
└── instrumentation-client.ts # Client-side instrumentation (Sentry)
```

### Directory Responsibilities

| Directory | What belongs here | What does NOT belong here |
|---|---|---|
| `app/` | Routes, layouts, metadata, suspense boundaries | Business logic, API calls, complex state |
| `components/ui/` | shadcn/ui primitives (Button, Dialog, etc.) | Feature-specific components |
| `components/layout/` | App shell, sidebar, header, page containers | Business logic |
| `features/` | Self-contained feature modules with their own components, stores, API | Shared utilities |
| `lib/` | Shared utilities, API client, helpers | Feature-specific code |
| `hooks/` | Shared custom React hooks | Feature-specific hooks (those go in `features/{name}/`) |
| `mfes/` | Micro-frontend applications (optional) | Regular features |
| `assets/` | Static assets (Figma-exported icons, images) | Code files |
| `types/` | Shared TypeScript types used across features | Feature-local types |

---

## 2. Key Configuration Files

### tsconfig.json

```jsonc
{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "incremental": true,
    "noEmit": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@/*": ["./src/*"],
      "~/*": ["./public/*"]
    },
    "plugins": [{ "name": "next" }]
  }
}
```

Key points:
- **Strict mode is non-negotiable** — every strict flag enabled
- **`noUncheckedIndexedAccess`** — array/object indexing returns `T | undefined`
- **Path aliases** — `@/` for source, `~/` for public assets
- **`lib` uses `es2022`** — not `esnext`, to keep target and lib aligned
- **`incremental: true`** with `.next/tsbuildinfo` for faster type checks

### eslint.config.ts

Flat config with typescript-eslint strict + type-checked:

```ts
// Key characteristics:
// - typescript-eslint strictTypeChecked (strict + type-aware rules)
// - Relaxed rules for shadcn/ui components (components/ui/**)
// - Custom no-process-env rule for src/ (use env.ts instead)
// - Import ordering with enforced groups (builtin, external, internal, relative)
// - unused-imports plugin for auto-removal on --fix
// - warn-in-dev/error-in-prod for no-console, no-unused-vars, import ordering
```

Rules relaxed for `components/ui/**` and `components/kbar/**`:
- These are copy-paste components from shadcn/ui or library wrappers — own the code but don't fight the generator's style
- All strict type rules, boolean expressions, and type assertions are relaxed
- `no-restricted-imports` is also disabled (these components may use lucide-react directly)

Custom `no-process-env` rule:
- Direct `process.env` access is forbidden inside `src/` (except `NODE_ENV`)
- All environment access must go through the validated `env.ts` module
- This ensures type-safe, validated environment variables everywhere
- Rule is defined locally in `scripts/eslint/rules/no-process-env-in-src`

### Prettier (.prettierrc)

```jsonc
{
  "arrowParens": "always",
  "bracketSpacing": true,
  "semi": true,
  "useTabs": false,
  "trailingComma": "none",
  "jsxSingleQuote": true,
  "singleQuote": true,
  "tabWidth": 2,
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

The Tailwind plugin auto-sorts CSS classes in a consistent order. Never manually sort Tailwind classes.

### next.config.ts

Key configuration aspects:

- **Build-time env validation** — imports `src/env.ts` via `jiti` before build starts
- **Standalone output** — `output: 'standalone'` for Docker/production deployments
- **Base path support** — configurable via `NEXT_PUBLIC_BASE_PATH` env var
- **SVG imports** — configured for both Webpack (`@svgr/webpack`) and Turbopack
- **Sentry integration** — conditionally enabled via `NEXT_PUBLIC_SENTRY_DISABLED`
- **Bundle analyzer** — enabled via `ANALYZE=true` environment variable
- **Security** — `poweredByHeader: false`, gzip compression enabled

### package.json Scripts

| Script | Command | Purpose |
|---|---|---|
| `preinstall` | `npx only-allow pnpm` | Enforce pnpm as package manager |
| `dev` | `next dev --turbopack` | Development server with Turbopack |
| `build` | `next build --turbopack` | Production build |
| `build:analyze` | `ANALYZE=true next build --turbopack` | Build with bundle analyzer |
| `start` | `node scripts/start-standalone.js` | Start standalone production server |
| `lint` | `tsc --noEmit && eslint . --fix --cache && pnpm format` | Full lint pass (types + lint + format) |
| `format` | `prettier --write . --log-level warn` | Format all files |
| `test:unit` | `vitest --run` | Unit/component tests |
| `test:ui:headless` | `playwright test` | E2E tests headless |
| `test:ui:headed` | `playwright test --headed` | E2E tests with browser visible |
| `test:all` | `pnpm test:unit && pnpm test:ui:headless` | All tests |
| `api:gen` | `tsx scripts/api-codegen/main.ts` | Swagger -> Zod codegen via Orval |
| `mock:serve` | `tsx mocks/cli/main.ts serve --generate` | Generate and serve mock API (Mockoon) |

---

## 3. Environment Configuration (t3-env)

All environment variables are validated with Zod at build time and runtime. The build crashes if validation fails — no silent misconfiguration.

### How It Works

```ts
// src/env.ts
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

// Custom schemas for common patterns
const booleanFlagSchema = z
  .union([z.literal('true'), z.literal('false'), z.literal(''), z.undefined()])
  .transform((v) => v === 'true');

const basePathSchema = z
  .union([z.string().trim(), z.undefined(), z.literal('')])
  .transform((value) => {
    if (typeof value !== 'string' || value.trim() === '') return '';
    const trimmed = value.trim();
    const normalized = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
    if (normalized !== '' && !normalized.startsWith('/')) return `/${normalized}`;
    return normalized;
  });

const optionalUrlSchema = z
  .union([z.string().url(), z.literal(''), z.undefined()])
  .transform((v) => (v === '' ? undefined : v));

export const env = createEnv({
  // Server-only variables — never exposed to client bundle
  server: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DISABLE_INSTRUMENTATION: booleanFlagSchema,
    SKIP_AUTH_SETUP: booleanFlagSchema,
  },

  // Client variables — must start with NEXT_PUBLIC_
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
    NEXT_PUBLIC_BASE_PATH: basePathSchema,
    NEXT_PUBLIC_SENTRY_DSN: optionalUrlSchema,
    NEXT_PUBLIC_SENTRY_DISABLED: booleanFlagSchema,
    NEXT_PUBLIC_TEST_MODE: booleanFlagSchema,
    NEXT_PUBLIC_DASHBOARD_EDITION: editionSchema,
  },

  // Runtime values (Next.js requires explicit mapping)
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DISABLE_INSTRUMENTATION: process.env.DISABLE_INSTRUMENTATION,
    SKIP_AUTH_SETUP: process.env.SKIP_AUTH_SETUP,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_DISABLED: process.env.NEXT_PUBLIC_SENTRY_DISABLED,
    NEXT_PUBLIC_TEST_MODE: process.env.NEXT_PUBLIC_TEST_MODE,
    NEXT_PUBLIC_DASHBOARD_EDITION: process.env.NEXT_PUBLIC_DASHBOARD_EDITION,
  },

  // Treat empty strings as undefined for better DX
  emptyStringAsUndefined: true,
});
```

### Build-time Validation via next.config.ts

Environment validation is triggered at build time by importing `env.ts` in `next.config.ts` using `jiti`:

```ts
// next.config.ts
import createJiti from 'jiti';
const jiti = createJiti(import.meta.url);
jiti('./src/env'); // Validates env vars before build proceeds
```

This ensures the build fails immediately if any environment variable is missing or malformed.

### Rules

1. **Never use `process.env` directly** — always `import { env } from '@/env'`
2. **ESLint enforces this** — the custom `no-process-env` rule catches violations in `src/` (except `NODE_ENV`)
3. **Server vars stay on the server** — t3-env prevents accidental client exposure via `onInvalidAccess` handler
4. **Add new vars to three places**: the `server`/`client` schema, `runtimeEnv`, and `.env.example`
5. **Fail fast** — missing or malformed vars crash the build immediately
6. **Custom schemas handle edge cases** — empty strings and undefined are handled gracefully via union types

---

## 4. Toolchain

| Tool | Purpose |
|---|---|
| **pnpm 10+** | Package manager (enforced via `preinstall` script — npm/yarn will fail) |
| **Next.js 16** | React framework with App Router |
| **React 19** | UI library |
| **TypeScript 5.7** | Type checking (strict mode, noUncheckedIndexedAccess) |
| **Zod 4** | Runtime schema validation (env vars, API responses, forms) |
| **ESLint 9 + typescript-eslint** | Linting (flat config, strictTypeChecked) |
| **Prettier + tailwind plugin** | Formatting with automatic Tailwind class sorting |
| **Tailwind CSS 4** | Utility-first CSS framework |
| **Vitest** | Unit and component tests (jsdom environment) |
| **Playwright** | End-to-end browser tests |
| **MSW** | Mock Service Worker for API mocking in tests |
| **Husky + lint-staged** | Git hooks (lint + format on commit) |
| **t3-env** | Environment variable validation (build-time + runtime, backed by Zod) |
| **Orval** | Swagger/OpenAPI -> Zod schema + API client codegen |
| **Turbopack** | Dev and build bundler (replaces Webpack) |
| **Sentry** | Error tracking and performance monitoring |
| **Mockoon** | Mock API server for local development |

### Why These Choices

- **pnpm** over npm/yarn: strict dependency resolution, disk-efficient, fast
- **Vitest** over Jest: native ESM, TypeScript-first, Vite-compatible
- **Playwright** over Cypress: multi-browser, faster, better TypeScript support
- **Orval** for codegen: generates typed API clients with Zod validation from OpenAPI specs, keeping frontend and backend in sync
- **Turbopack**: Next.js native bundler, significantly faster than Webpack for dev and builds
- **Zod 4** over Zod 3: better performance, cleaner API, first-class JSON schema support

---

## 5. Setup Checklist

### For New Projects

1. **Clone/copy template**
   ```bash
   # Copy the template, rename to your project
   cp -r template/ my-project/
   cd my-project
   git init
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env.local
   # Fill in all required values — build will fail if any are missing
   ```

4. **Verify linting passes**
   ```bash
   pnpm lint
   # Should pass clean: zero type errors, zero lint errors, formatted
   ```

5. **Verify tests pass**
   ```bash
   pnpm test:unit
   ```

6. **Verify dev server starts**
   ```bash
   pnpm dev
   # Should start without errors, visit http://localhost:3000
   ```

7. **Customize for your project**
   - Remove example MFEs if not needed (simplify to `features/` only)
   - Add your features under `src/features/`
   - Configure API codegen for your backend (update `orval.config.ts`)
   - Add/remove shadcn/ui components as needed

8. **Update AGENTS.md**
   - Fill project-specific architecture decisions
   - Document domain vocabulary and key workflows
   - List any project-specific conventions that differ from defaults

---

## 6. App Router Conventions

### What Goes in `app/`

The `app/` directory handles **routing infrastructure only**:

- **Route segments** — directory-based routing
- **Layouts** — shared UI shells (`layout.tsx`)
- **Metadata** — SEO, Open Graph (`metadata` export or `generateMetadata`)
- **Loading states** — `loading.tsx` for Suspense boundaries
- **Error boundaries** — `error.tsx` for route-level error handling
- **Not found** — `not-found.tsx` for 404 pages

### What Does NOT Go in `app/`

- Business logic
- Complex state management
- Direct API calls (use feature modules)
- Reusable components (use `components/` or `features/`)

### Thin Page Files

Page files should be minimal — delegate to feature components:

```tsx
// app/dashboard/page.tsx — GOOD: thin page, delegates to feature
import { DashboardView } from '@/features/dashboard/components/dashboard-view';

export const metadata = {
  title: 'Dashboard'
};

export default function DashboardPage() {
  return <DashboardView />;
}
```

```tsx
// app/dashboard/page.tsx — BAD: page contains business logic
export default function DashboardPage() {
  const [data, setData] = useState(null);
  useEffect(() => { fetch('/api/stats').then(/* ... */) }, []);
  return <div>{/* 200 lines of JSX */}</div>;
}
```

### Route-Level Error Boundaries

```tsx
// app/dashboard/error.tsx
'use client';

export default function DashboardError({
  error,
  reset
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

---

## 7. Provider Stack Pattern

The root layout composes providers in a specific order. Outermost providers are available to all inner providers and their children.

### Root Layout

```tsx
// app/layout.tsx
import { ThemeProvider } from '@/components/layout/theme-provider';
import { EditionProvider } from '@/features/edition/edition-provider';
import { AuthProvider } from '@/features/auth/auth-provider';

export default function RootLayout({
  children
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <EditionProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </EditionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### Provider Order Matters

```
ThemeProvider        — outermost: theming available everywhere
  EditionProvider   — app edition/config context
    AuthProvider    — auth state, can use theme + edition context
      {children}   — all pages have access to all providers
```

Rules:
- Providers that others depend on go **outermost**
- Auth typically wraps page content but sits inside theme/config
- Each provider should be a separate component file, not inline in layout
- `'use client'` boundary goes on the provider component, not the layout

---

## 8. Adaptation Guide

The template is a starting point. Adapt it to your project's needs.

### Remove MFE Architecture (most projects)

If your project is not a micro-frontend host, simplify:

```
# Before (template default):
src/mfes/          # MFE infrastructure
src/features/      # Feature modules

# After (simplified):
src/features/      # All feature modules live here
```

Delete `src/mfes/` entirely. Move any useful patterns into `src/features/`.

### Configure API Codegen

Update `orval.config.ts` to point at your backend's OpenAPI spec:

```ts
export default {
  api: {
    input: {
      target: 'https://your-backend.com/api/v1/openapi.json'
      // Or local: './openapi.json'
    },
    output: {
      target: './src/lib/api/generated.ts',
      client: 'fetch',
      override: {
        zod: { strict: true }
      }
    }
  }
};
```

Run `pnpm api:gen` after backend API changes to regenerate typed clients.

### Add/Remove shadcn/ui Components

```bash
# Add components as needed
pnpm dlx shadcn@latest add button dialog dropdown-menu

# Components land in src/components/ui/ — you own the code
# Customize freely, but keep the file in components/ui/
```

### Set Up Environment Variables

1. Add the variable to `src/env.ts` (schema + runtimeEnv)
2. Add it to `.env.example` with a placeholder value
3. Add it to `.env.local` with the real value
4. Access via `import { env } from '@/env'` — never `process.env`

### Customize Auth Flow

The template includes a generic auth provider pattern. Adapt it:

- **OAuth/OIDC**: Configure provider in `AuthProvider`, add callback routes in `app/auth/`
- **Session-based**: Add session management to `AuthProvider`, configure middleware
- **Token-based**: Add token refresh logic, configure API client interceptors

### Quick Customization Checklist

- [ ] Directory layout matches your domain (removed MFEs if not needed)
- [ ] Environment variables configured for your services
- [ ] API codegen pointed at your backend
- [ ] Auth flow matches your backend's auth strategy
- [ ] shadcn/ui components added for your UI needs
- [ ] AGENTS.md describes *this* project, not the generic template
- [ ] Example/placeholder routes removed, your features added
- [ ] CI/CD pipeline configured for your deployment target
