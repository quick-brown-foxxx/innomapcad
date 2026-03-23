# Development Philosophy

This document defines the foundational beliefs that drive all coding decisions.
Every other document in this collection inherits from and applies these principles to specific domains.

---

## 1. The Pit of Success

Build systems where doing things correctly is the path of least resistance.
Instead of relying on conventions that developers must remember, construct boundaries that make violations impossible.

- Strict type checking that rejects ambiguity at compile time
- Linters that enforce rules automatically, not through code review
- Architecture that separates concerns structurally, not by agreement
- Error handling that forces callers to address failures, not ignore them

**The investment is front-loaded.** We spend time setting up types, linters, schemas, and architecture to minimize time spent on bug fixes, manual testing, and debugging later. Both Python and TypeScript are dynamic by default — we actively work against that default.

## 2. Explicitness Through Types

Everything should be known before runtime. We always know what types and values we have. We always know whether we are on the error path or the success path.

- **Strict type checking is non-negotiable.**
  - **TypeScript:** strict mode, ESLint with `@typescript-eslint/strict-type-checked`. No `any`, no non-null assertions (`!`), no unvalidated `@ts-ignore`.
  - **Python:** basedpyright in strict mode, `reportAny=error`. No `Any`, no `typing.cast()`, no unvalidated `# type: ignore`.
- **Errors are values, not exceptions.** Use `Result<T, E>` / `Result[T, E]` for expected failures. Exceptions are reserved for programming errors (impossible states, invariant violations) — they mean "this is a bug."
- **Data has shape.**
  - **TypeScript:** Zod schemas for external data (JSON, APIs, form inputs). TypeScript interfaces/types for domain objects. Never pass raw `unknown` through business logic.
  - **Python:** `msgspec.Struct` for external data (JSON, configs, APIs). `dataclass` for domain objects. `TypedDict` only when dict compatibility is required. Never pass raw `dict` through business logic.
- **Dynamic boundaries get validated.** Third-party libraries with weak typing get typed wrappers. Untyped data from outside (user input, network, files) gets validated and narrowed immediately at the boundary.

The goal: if the type checker says it's correct, it runs correctly. If something can fail, the type signature says so.

## 3. Fail Fast, Fail Early

Detect problems at the earliest possible moment. Compile time is better than runtime. Build/startup is better than mid-operation. Explicit error is better than silent corruption.

- **Validate preconditions** at entry points: API responses, form inputs, route params, required permissions, configuration
- **Validate postconditions** where output correctness matters
- **No escape hatches.** Don't allow `any`/`Any`, `as`/`cast()` to bypass safety, blanket `@ts-ignore`/`type: ignore`, or empty `catch {}`/`except Exception: pass` to silently bypass the safety net
- **Type narrowing over assumptions.** When a value could be multiple types, narrow it with type guards, Zod parsing, discriminated unions, `isinstance`, `TypeIs`, or pattern matching — never assume

## 4. Error Handling as Control Flow

Errors are a normal part of program execution, not exceptional events. The type system should track them.

- **Expected failures** (IO, network, user input, API calls, form validation): return `Result<T, E>` / `Result[T, E]` — the caller must handle both paths
- **Programming errors** (violated invariants, impossible states): throw/raise exceptions — these are bugs, the program should crash
- **Boundaries**: catch/wrap foreign errors immediately, convert to Result — don't let raw responses or foreign exception hierarchies leak through layers
- **Error boundaries**: UI layers catch all remaining errors and present user-friendly messages. Business logic never swallows errors silently
- **Early returns**: handle the error case first, keep the success path unindented and linear

## 5. Testing Philosophy

Tests exist to prove that features work, not to produce green checkmarks.

- **Trustworthiness over coverage.** A test that mocks away the thing it's testing proves nothing. Coverage numbers are a guideline, not a goal.
- **E2e tests are the primary safety net.** They test real behavior through real code paths. 5 good e2e tests give more confidence than 100 unit tests with heavy mocking.
- **Unit/component tests for pure logic and interaction.** Functions that transform data, components that handle user events — these are worth testing because they're honest.
- **Real over mocked.** Prefer real HTTP servers / MSW over patched/mocked modules. Prefer real file systems (via tmp dirs) over mocked IO. When mocking is necessary, mock at the boundary, not the module level.
- **20/80 rule.** Invest test effort where it gives the most confidence. Don't chase 100% coverage in utilities while core workflows go untested.

## 6. Architecture: Separation by Responsibility

Separate what changes for different reasons. Separate what should be testable independently.

- **Layered dependency flow:** Presentation (UI/CLI) → Domain (business logic) → Utilities. Never upward. Never skip layers.
- **UI is a consumer/plugin.** The same business logic should serve multiple interfaces (React frontend, CLI, API). The core never imports from UI.
- **Data vs. logic.** Domain types carry data. Services/managers operate on data. Utilities are stateless pure functions.
- **Scale-appropriate separation.** In large features: separate files, directories, layers. In small features: colocate what belongs together. The principle is the same; the implementation scales.
- **Wrap third-party libraries.** Isolate external dependencies behind typed interfaces for type safety, testability, and swappability.
- **Validate at boundaries.** Schemas validate API responses, user input, and configuration. Internal code trusts validated data.

## 7. Tooling: Fast, Strict, Modern

Use tools that enforce the philosophy automatically. Prefer tools that are fast, opinionated, and integrated.

### TypeScript
- **`pnpm`** for package management
- **`TypeScript`** strict mode + ESLint type-aware rules
- **`Prettier`** for formatting (with Tailwind CSS plugin)
- **`Vitest`** for component/integration tests, **`Playwright`** for e2e
- **`Husky + lint-staged`** for git hooks
- **`Zod`** for runtime validation, **`Orval`** for API codegen

### Python
- **`uv`** for package management and script execution
- **`basedpyright`** for type checking (strict mode)
- **`ruff`** for linting and formatting
- **`pytest`** for testing
- **`pre-commit`** for git hooks

### Shared Principles
- Modern language features, latest stable versions
- Git hooks automate quality checks on every commit
- No manual enforcement — tools catch what humans miss

## 8. Standard Stacks

### TypeScript / React
- **UI**: shadcn/ui (Radix + Tailwind + CVA)
- **State**: Zustand for stores, React Hook Form + Zod for forms, nuqs for URL state
- **Styling**: Tailwind CSS with design tokens
- **API**: Native fetch wrapped in typed client, Zod validation, Orval codegen
- **Routing**: Next.js App Router

### Python
- **CLI**: typer with `uv`
- **GUI**: PySide6 with qasync
- **HTTP**: httpx (async-capable)
- **Text generation**: Jinja2 templates
- **Config**: YAML + msgspec validation
- **Async**: for all I/O operations

## 9. Project Setup: Invest Early

Every project starts with the safety net configured:

- Strict type checking, linting, formatting — all automated
- Environment/configuration validation — fail at startup, not at runtime
- Git hooks — every commit is checked
- Testing infrastructure — ready from day one

**The overhead is worth it.** Spending time on setup saves hours of debugging implicit failures later. This is the pit of success in action.
