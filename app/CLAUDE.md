# app/ — FE conventions

The React companion (Vite + React 19 + TS). A read-only **consumer of `state.json`** via `ITransport`.
Adapted from the klang-web FE rules — only the parts that fit a small, single-view app.

## Layers

- **UI** in `src/components/` (presentational, props-in).
- **Logic** in hooks (`use-*.ts`) and pure helpers (`view.ts`). No business logic in components.
- **Data source** is `transport.ts` — the only place that knows about SSE / `EventSource`.
- `app.tsx` is **composition only**: a hook (or two) → guard → JSX.

## Components

One component per file; functional; `export default`. Template:

```tsx
interface IProps {
  state: IState;
}

const Hud = (props: IProps) => {
  const { state } = props;
  return <div className="hud">…</div>;
};

export default Hud;
```

**Body order (never interleaved):** props/locals → hooks (`useX`) → `useState` → derived (`useMemo`) →
`useEffect` → handlers → guards → JSX.

Don't wrap a one-line element in a component. When *logic* bloats a component, extract a hook — not
another component.

## Hooks & derived data

- Feature hook: `use-<x>.ts`, exports `useX`. `useEffect` is **only** for syncing with the outside
  world (e.g. subscribing to the transport) — not a generic "re-run on change".
- Anything derived from state is a module-level pure helper (`view.ts`) or a `useMemo` — never
  recomputed inline in JSX.

## Types & naming

- `interface I*` for shapes; `type T*` for unions/aliases. **String enums, never bare string-literal
  unions.**
- kebab-case file names. Import the shared `IState` **type-only** from `../../core/state` — never
  duplicate it, never import runtime `core` code. (`verbatimModuleSyntax` enforces `import type`.)
- The **events contract** (`EventType` enum + types) from `../../core/events` MAY be imported at
  runtime (it is the shared wire contract, like `IState`). Game logic — `reduce`, `classes`, etc. —
  may not.
