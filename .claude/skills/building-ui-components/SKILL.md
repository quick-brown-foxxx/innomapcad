---
name: building-ui-components
description: "UI component patterns: shadcn/ui, component organization, variant system. Use when building or modifying React UI components. ALWAYS load this skill when working with react code."
---

# Building UI Components

## 1. Component Library: shadcn/ui

- **Copy-paste model**: components live in `src/components/ui/`, you own the code
- Built on **Radix UI** primitives (accessible, composable)
- Styled with **Tailwind CSS + CVA** (class-variance-authority) for variants
- Add components: `npx shadcn@latest add button`
- Customize freely — these are YOUR components, not a dependency

## 2. Component Organization

| Location | Purpose | Examples |
|----------|---------|---------|
| `src/components/ui/` | shadcn/ui primitives | Button, Card, Dialog, Input |
| `src/components/layout/` | App shell, navigation | Header, Sidebar, PageContainer |
| `src/mfes/{domain}/components/` | Feature-specific | ProductCard, OrderTable |
| `src/app/` | Route components | page.tsx, layout.tsx |

## 3. Component Pattern

```typescript
// Feature component — custom props interface with readonly
interface ProductCardProps {
  readonly product: Product;
  readonly onDelete?: (id: string) => Promise<void>;
}

export function ProductCard({ product, onDelete }: ProductCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{product.name}</CardTitle>
      </CardHeader>
      <CardContent>{/* UI rendering */}</CardContent>
    </Card>
  );
}

// UI primitive — use React.ComponentProps, data-slot, export at bottom
function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn('bg-card text-card-foreground ...', className)}
      {...props}
    />
  );
}

export { Card };
```

Rules:

- **Named exports** (not default, except Next.js pages)
- **`readonly`** on all custom props interfaces
- **Explicit return types** on exported feature components
- **UI primitives** use `React.ComponentProps<'element'>` and `data-slot`
- For state and logic patterns, see the **managing-state** skill

## 4. Variant System (CVA)

```typescript
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 ...',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive: 'bg-destructive text-white shadow-xs hover:bg-destructive/90 ...',
        outline: 'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground ...',
        secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
```

Key patterns:
- **`React.ComponentProps<'element'>`** for prop types (not `HTMLAttributes`)
- **`asChild` + Slot** for polymorphic rendering (render as child element)
- **`data-slot`** attribute on every component for styling/testing hooks
- **`className` passed inside `buttonVariants()`**, not as separate `cn()` arg
- **Named exports at bottom**, not inline `export function`

## 5. Design Tokens (CSS Variables)

- Colors: `primary`, `secondary`, `destructive`, `muted`, `accent`, `background`, `foreground`
- Each has a `-foreground` counterpart for text
- Sidebar-specific: `sidebar-primary`, `sidebar-accent`, etc.
- Defined in CSS, consumed via Tailwind: `bg-primary`, `text-muted-foreground`

## 6. Utility: cn() Function

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Always use `cn()` to merge Tailwind classes — handles conflicts correctly.

## 7. Loading/Error/Empty States

Every data-driven component should handle three states:

```tsx
function ItemsList({ items, loading, error }: ItemsListProps) {
  if (loading) return <Skeleton />;
  if (error !== null) return <ErrorMessage message={error.errorMessageForUser} />;
  if (items.length === 0) return <EmptyState />;
  return <ul>{items.map(...)}</ul>;
}
```

## 8. Accessibility Basics

- Use semantic HTML (`button` not `div` with `onClick`)
- Use Radix UI primitives (already accessible)
- Always provide `aria-label` for icon-only buttons
- Test with keyboard navigation

## 9. Cross-References

- For **state management** in components (stores, forms, URL state): see **managing-state** skill
- For **API integration** patterns: see **building-api-clients** skill
- For **testing components**: see **testing-react-ts** skill
