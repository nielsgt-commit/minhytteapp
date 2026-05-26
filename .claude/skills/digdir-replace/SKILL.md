---
name: digdir-replace
description: Use this skill when replacing native HTML elements (select, input,
  button, label, checkbox, switch, dialog, etc.) with their counterparts from
  `@digdir/designsystemet-react`. Scope is strictly the swap — do not refactor
  surrounding logic, restyle, or add features.
---

## Scope (hard limits)

- One-for-one replacement of native elements with digdir components.
- Preserve existing behavior, props, state, and accessibility intent.
- Do **not** refactor surrounding logic, change layout, add features, or
  restyle. If a change beyond a swap looks tempting, stop and ask.

## Required steps, in order

1. **Verify CSS is loaded.** Grep the app entry (typically
   `client/src/main.tsx`) for `@digdir/designsystemet-css`. If missing, add
   _both_ lines once at the entry, before app code:

   ```ts
   import "@digdir/designsystemet-css/theme"
   import "@digdir/designsystemet-css"
   ```

   Without these the components render as bare native inputs and look
   identical to what they're replacing — the user will (correctly) think the
   swap didn't take effect.

2. **Look up the component API in Context7** before writing the replacement.
   Library id: `/digdir/designsystemet`. Query for the exact component
   (e.g. "Select component options onChange", "Switch checked label
   onChange"). Do this even for components that look obvious — props differ
   from native HTML and from each other.

3. **Apply the swap.** Map carefully:
   - Sub-elements use dot notation: `<option>` → `<Select.Option>`,
     `<optgroup>` → `<Select.Optgroup>`.
   - Some components have a built-in `label` prop (e.g. `Switch`) — use it
     instead of pairing with a separate `Label`.
   - When using a separate `Label`, link with `htmlFor` + `id` (replaces
     `aria-label` on the native element).
   - `onChange` event types may differ; trust the Context7 example.

4. **Clean up imports.** Remove anything no longer used (e.g. `useId` once a
   built-in `label` prop replaces a manual `<label htmlFor={id}>`). Don't
   leave dead `Label` imports if `Switch.label` covers it.

5. **Verify rendering, not just types.** TS/lint passing is necessary but
   not sufficient — missing CSS won't surface as a diagnostic. If you can't
   open a browser yourself, say so explicitly and ask the user to confirm
   the visual.

## Per-component cheatsheet (extend as you learn)

| Native                                              | digdir                                         | Notes                                                                                                                          |
| --------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `<select>` + `<option>`                             | `Select` + `Select.Option`                     | `value`/`onChange` similar to native; use sibling `Label` with `htmlFor`/`id`.                                                 |
| `<input type="checkbox" role="switch">` + `<label>` | `Switch`                                       | Has a `label` prop — don't add a separate `Label`. `onChange` gives a `ChangeEvent`; read `e.target.checked`.                  |
| `<label>`                                           | `Label`                                        | Pair with a component `id` via `htmlFor`.                                                                                      |
| Custom dropdown trigger                             | `Dropdown.Trigger` (renders a `Button` itself) | Pass Button props (`variant`, `data-color`, `aria-*`) directly on `Dropdown.Trigger` — do **not** nest a `<Button>` inside it. |

## Anti-patterns (seen in this codebase)

- Importing `Switch, Label` and then keeping `Label` after switching to
  `Switch`'s built-in `label` prop. Drop the unused import.
- Replacing `<select>` with `Select` but leaving `<option>` children — the
  digdir build expects `Select.Option`.
- Skipping step 1 ("CSS already imported, right?"). Always grep first.
- **Wrapping a `<Button>` inside `<Dropdown.Trigger>`** (the Context7 docs
  literally show this pattern, but it's a trap). `Dropdown.Trigger` →
  `PopoverTrigger`, which already renders a `Button` itself by default. A
  nested Button produces `<button><button>label</button></button>`: outer =
  default `variant="primary"` (filled accent, e.g. blue), inner = whatever
  you set (often tertiary/transparent). Symptom: trigger looks filled blue,
  text invisible until hover. Fix: pass `variant`, `data-color`, `aria-*`
  directly on `Dropdown.Trigger`, no inner `<Button>`.

## When in doubt

If the Context7 example and the existing code disagree on prop shape (e.g.
`onChange` signature, controlled vs uncontrolled), match the Context7
example and adapt the call site — not the other way around.
