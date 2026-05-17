import { Card } from "@digdir/designsystemet-react"
import { DeletePropertyFlow } from "./DeletePropertyFlow.tsx"
import { WipeDbFlow } from "./WipeDbFlow.tsx"

export function DangerZone() {
  return (
    <Card asChild>
      <section>
        <h3>Danger zone</h3>
        <p>
          Destructive actions below. These are irreversible — proceed with care.
        </p>
        <DeletePropertyFlow />
        <WipeDbFlow />
      </section>
    </Card>
  )
}