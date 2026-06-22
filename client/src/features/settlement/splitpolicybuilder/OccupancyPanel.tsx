import { useState } from "react"
import { Button, Card, Heading } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { OccupancyCounting } from "./OccupancyCounting"
import styles from "./OccupancyPanel.module.css"
import type { OccupancyWindow, SplitPolicyOccupancy } from "./types"

// Standalone panel above the policy builder for the shared person-day counting
// definition. It carries a local edit/save toggle but stays wired to the
// builder's form state via patchOccupancy, so saving the policy persists it.
type Props = {
  occupancy: SplitPolicyOccupancy
  eligibleOwners: { user_group_id: number; user_group_name: string }[]
  windowKinds: Set<OccupancyWindow["kind"]>
  extraGuests: boolean
  patchOccupancy: (patch: Partial<SplitPolicyOccupancy>) => void
  // Persists just the occupancy to the saved policy. Null for an unsaved policy,
  // where the occupancy rides along on the full policy save instead.
  onPersist: (() => Promise<void>) | null
  pending: boolean
}

export function OccupancyPanel({
  occupancy,
  eligibleOwners,
  windowKinds,
  extraGuests,
  patchOccupancy,
  onPersist,
  pending,
}: Props) {
  const { t } = useTranslation("settlement")
  const [editing, setEditing] = useState(false)

  const onToggle = () => {
    if (!editing) {
      setEditing(true)
      return
    }
    if (onPersist == null) {
      setEditing(false)
      return
    }
    void onPersist().then(
      () => {
        setEditing(false)
      },
      () => {
        // Persist failed: stay in edit mode. The error is shown via ErrorAlert.
      },
    )
  }

  return (
    <Card asChild>
      <section>
        <div className={styles.header}>
          <Heading level={4} data-size="2xs">
            {t("Counting person-days")}
          </Heading>
          <Button
            type="button"
            variant={editing ? "primary" : "tertiary"}
            data-size="sm"
            disabled={pending}
            onClick={onToggle}
          >
            {editing ? t("Save") : t("Edit")}
          </Button>
        </div>

        <OccupancyCounting
          occupancy={occupancy}
          eligibleOwners={eligibleOwners}
          showLabel={false}
          edit={
            editing
              ? { pending, windowKinds, extraGuests, onPatch: patchOccupancy }
              : undefined
          }
        />
      </section>
    </Card>
  )
}
