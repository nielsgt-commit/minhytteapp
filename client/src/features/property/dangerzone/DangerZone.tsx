import { DeletePropertyFlow } from "./DeletePropertyFlow.tsx"

export function DangerZone() {
  return (
    <section>
      <h3>Danger zone</h3>
      <p>
        Destructive actions below. These are irreversible — proceed with care.
      </p>
      <DeletePropertyFlow />
    </section>
  )
}