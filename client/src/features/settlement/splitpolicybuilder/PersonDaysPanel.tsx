import { OccupancyPanel } from "./OccupancyPanel"
import { useSplitPolicyContext } from "./SplitPolicyContext"

// Route/section host for the person-day counting panel. Reads the shared policy
// form from context so its edits and saves stay wired to the builder. Always
// rendered — the counting definition is configurable regardless of whether a
// rule currently splits by person-days (that strategy is picked in the policy).
export function PersonDaysPanel() {
  const ctx = useSplitPolicyContext()

  return (
    <OccupancyPanel
      occupancy={ctx.form.occupancy}
      eligibleOwners={ctx.eligibleOwners}
      windowKinds={ctx.allowed.windowKinds}
      extraGuests={ctx.allowed.extraGuests}
      patchOccupancy={ctx.patchOccupancy}
      onPersist={ctx.persistOccupancy}
      pending={ctx.pending}
    />
  )
}
