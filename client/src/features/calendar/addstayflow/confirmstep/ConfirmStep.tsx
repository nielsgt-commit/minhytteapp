import { Button, Heading, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { groupConsecutive } from "@/features/calendar/booking-logic"
import type { BookingDraft, PreviewConflicts } from "@/features/calendar/booking-logic"
import styles from "./ConfirmStep.module.css"

function formatDateRanges(isos: string[]): string {
  return groupConsecutive(isos)
    .map(r => (r.start === r.end ? r.start : `${r.start} – ${r.end}`))
    .join(", ")
}

export function ConfirmStep({
  conflicts,
  draft,
  onConfirm,
  onCancel,
  isMutating,
  roomOverCapacityDays,
}: {
  conflicts: PreviewConflicts
  draft: BookingDraft
  onConfirm: (d: BookingDraft) => void
  onCancel: () => void
  isMutating: boolean
  roomOverCapacityDays: Map<number, string[]>
}) {
  const { t } = useTranslation("calendar")
  const overflowIds = new Set<number>()
  for (const r of conflicts.perRoom) {
    for (const uid of r.adultInKidOnlyUserIds) overflowIds.add(uid)
  }
  if (conflicts.property.overCapacityBy > 0) {
    let rem = conflicts.property.overCapacityBy
    for (const o of [...draft.occupants.filter(x => x.room_id == null)].reverse()) {
      if (rem <= 0) break
      overflowIds.add(o.user_id)
      rem--
    }
  }

  return (
    <div className={styles.warningBox}>
      <Heading level={4}>{t("Warnings — confirm to proceed")}</Heading>

      {conflicts.property.overCapacityBy > 0 && (
        <Paragraph>
          {t("Property over capacity by {{count}} person", { count: conflicts.property.overCapacityBy })}
        </Paragraph>
      )}

      {conflicts.perRoom.map(r => {
        const days = roomOverCapacityDays.get(r.room_id) ?? []
        return (
          <div key={r.room_id}>
            {r.overCapacityBy > 0 && days.length > 0 && (
              <Paragraph>
                {t("Room \"{{room}}\" over capacity by {{count}} on {{days}}.", { room: r.room_name, count: r.overCapacityBy, days: formatDateRanges(days) })}
              </Paragraph>
            )}
            {r.adultInKidOnlyUserIds.length > 0 && (
              <Paragraph data-color="danger">
                {t("Adult assigned to \"{{room}}\" where only kid-only beds remain.", { room: r.room_name })}
              </Paragraph>
            )}
          </div>
        )
      })}

      {overflowIds.size > 0 && (
        <Paragraph className={styles.queueNote}>
          {t("{{count}} occupant will be marked queued on submit.", { count: overflowIds.size })}
        </Paragraph>
      )}

      <div className={styles.actions}>
        <Button
          type="button"
          onClick={() => {
            onConfirm({
              ...draft,
              occupants: draft.occupants.map(o => ({
                ...o,
                queued: overflowIds.has(o.user_id) ? true : o.queued,
              })),
            })
          }}
          disabled={isMutating}
        >
          {t("Request anyway")}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isMutating}>
          {t("Cancel")}
        </Button>
      </div>
    </div>
  )
}
