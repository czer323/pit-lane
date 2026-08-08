# Component Library

Pit Lane uses **shadcn-solid** (port of shadcn/ui for SolidJS). Components are source files in `src/components/ui/` — not an npm package.

## Conventions

- Every component is a standalone `.tsx` file in `src/components/ui/`
- Components use `cva` for variants, `cn()` for class merging, Tailwind for styling
- Shared utility: `src/components/ui/cn.ts` — every component imports from `./cn`
- Design tokens live in Tailwind config (`src/app.css` CSS variables)
- Add new components by copying from the shadcn-solid registry: `https://github.com/hngngn/shadcn-solid/tree/main/apps/docs/src/registry/ui`

## Dependencies

All already installed in `package.json`:

- `tailwindcss` + `@tailwindcss/vite` — CSS framework
- `tw-animate-css` — animation utilities
- `class-variance-authority` — component variants
- `clsx` + `tailwind-merge` — class merging (via `cn.ts`)

## Design Tokens

Defined as CSS custom properties in `src/app.css` under `:root`. Matches `docs/design-system/tokens.json`.

| Token                | Value     | Usage                           |
| -------------------- | --------- | ------------------------------- |
| `--background`       | `#0d0d0d` | Page background                 |
| `--foreground`       | `#ffffff` | Primary text                    |
| `--card`             | `#161616` | Card/surface background         |
| `--primary`          | `#f9a825` | Accent — buttons, active states |
| `--border`           | `#2a2a2a` | Borders, dividers               |
| `--muted-foreground` | `#757575` | Secondary text                  |

## Installed Components

| Component | File | Variants |
| Input | `src/components/ui/input.tsx` | — |
| Textarea | `src/components/ui/textarea.tsx` | — |
| Label | `src/components/ui/label.tsx` | — |
| Card | `src/components/ui/card.tsx` | Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter |
| Badge | `src/components/ui/badge.tsx` | variant: default, secondary, destructive, outline |
| Separator | `src/components/ui/separator.tsx` | orientation: horizontal, vertical |
| Switch | `src/components/ui/switch.tsx` | checked, onCheckedChange |
| Tabs | `src/components/ui/tabs.tsx` | Tabs, TabsList, TabsTrigger, TabsContent — value-based |
| Select | `src/components/ui/select.tsx` | Select, SelectTrigger, SelectContent, SelectItem — string options |
| Button | `src/components/ui/button.tsx` | variant: default, destructive, outline, secondary, ghost, link · size: sm, default, lg, icon |

## Adding a Component

1. Find the component source in the shadcn-solid registry
2. Copy to `src/components/ui/<name>.tsx`
3. It imports `./cn` — that file already exists
4. Use in pages: `import { ComponentName } from "~/components/ui/<name>"`

## Usage Example

```tsx
import { Button } from "~/components/ui/button";

<Button variant="default" size="lg">
  Submit Pass
</Button>;
```
