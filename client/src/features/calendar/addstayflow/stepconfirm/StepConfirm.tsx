import type { Dispatch, ReactNode } from "react"
import { Button, Field, Heading, Label, Paragraph, Select, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { setNotes, setStatus } from "@/features/calendar/booking-logic"
import type { BookingDraft, BookingDraftAction, PreviewConflicts } from "@/features/calendar/booking-logic"
import { ConfirmStep } from "../confirmstep/ConfirmStep.tsx"
import type { SubmitAction, SubmitState } from "../../hooks/useBookingForm.ts"
import { RoomShape } from "@/features/calendar/types.ts"
import styles from "./StepConfirm.module.css"

type User = { id: number; name: string; is_child: boolean | null }
type Structure = { id: number; name: string }
type DraftOccupant = { user_id: number; queued: boolean }

export function StepConfirm({
  isActive,
  draft,
  dispatch,
  users,
  propertyStructures,
  propertyRooms,
  occupantsByRoom,
  unassigned,
  conflicts,
  submitState,
  submit,
  hasWarnings,
  canSubmit,
  isPending,
  roomOverCapacityDays,
  stepClass,
  stepActiveClass,
  submitLabel,
  submitWarningsLabel,
  submitPendingLabel,
  extraActions,
}: {
  isActive: boolean
  draft: BookingDraft
  dispatch: Dispatch<BookingDraftAction>
  users: User[]
  propertyStructures: Structure[]
  propertyRooms: RoomShape[]
  occupantsByRoom: Map<number | null, DraftOccupant[]>
  unassigned: DraftOccupant[]
  conflicts: PreviewConflicts | undefined
  submitState: SubmitState
  submit: (action: SubmitAction) => void
  hasWarnings: boolean
  canSubmit: boolean
  isPending: boolean
  roomOverCapacityDays: Map<number, string[]>
  stepClass: string
  stepActiveClass: string
  submitLabel?: string
  submitWarningsLabel?: string
  submitPendingLabel?: string
  extraActions?: ReactNode
}) {
  const { t } = useTranslation("calendar")
  const bookerName = users.find(u => u.id === draft.booker_id)?.name ?? "—"
  const nights = draft.start_date && draft.end_date
    ? Math.round((new Date(draft.end_date).getTime() - new Date(draft.start_date).getTime()) / 86400000)
    : null
  const guestNames = draft.occupants
    .filter(o => o.user_id !== draft.booker_id)
    .map(o => {
      const u = users.find(x => x.id === o.user_id)
      if (!u) return `#${String(o.user_id)}`
      return `${u.name}${u.is_child ? t(" (child)") : ""}${o.queued ? t(" (queued)") : ""}`
    })
  const roomEntries = propertyStructures.flatMap(b =>
    propertyRooms
      .filter(r => r.structure_id === b.id)
      .map(r => {
        const occs = (occupantsByRoom.get(r.id) ?? []).map(o => {
          const u = users.find(x => x.id === o.user_id)
          return u ? `${u.name}${u.is_child ? t(" (child)") : ""}` : `#${String(o.user_id)}`
        })
        return { structureName: b.name, roomName: r.name, occupants: occs }
      })
      .filter(e => e.occupants.length > 0),
  )
  const unassignedNames = unassigned.map(o => {
    const u = users.find(x => x.id === o.user_id)
    return u
      ? `${u.name}${u.is_child ? t(" (child)") : ""}`
      : `#${String(o.user_id)}`
  })

  return (
    <div className={`${stepClass} ${isActive ? stepActiveClass : ""}`}>
      <div className={styles.card}>
        <Heading level={4}>{t("Review request")}</Heading>
        <dl className={styles.list}>
          <dt>
            <strong>{t("When")}</strong>
          </dt>
          <dd className={styles.item}>
            {draft.start_date && draft.end_date && nights != null
              ? `${draft.start_date} → ${draft.end_date} (${t("{{count}} night", { count: nights })})`
              : t("Dates not selected")}
          </dd>

          <dt>
            <strong>{t("Who")}</strong>
          </dt>
          <dd className={styles.item}>
            {bookerName} {t("(booker)")}
            {guestNames.length > 0 && <> · {guestNames.join(", ")}</>}
          </dd>

          <dt>
            <strong>{t("Where")}</strong>
          </dt>
          <dd className={styles.item}>
            {roomEntries.length === 0 &&
              unassignedNames.length === 0 &&
              t("No occupants yet")}
            {roomEntries.length > 0 && (
              <ul className={styles.subList}>
                {roomEntries.map(e => (
                  <li key={`${e.structureName}-${e.roomName}`}>
                    {e.structureName} · {e.roomName}: {e.occupants.join(", ")}
                  </li>
                ))}
              </ul>
            )}
            {unassignedNames.length > 0 && (
              <div>{t("Unassigned: {{names}}", { names: unassignedNames.join(", ") })}</div>
            )}
          </dd>

          <dt>
            <strong>{t("Status")}</strong>
          </dt>
          <dd className={styles.itemLast}>
            {draft.status}
          </dd>
        </dl>
      </div>

      <div className={styles.card}>
        <Heading level={4}>{t("Details")}</Heading>
        <div className={styles.fields}>
          <Field>
            <Label>{t("Status")}</Label>
            <Select
              value={draft.status}
              onChange={e => {
                dispatch(
                  setStatus(
                    e.target.value as "pending" | "confirmed" | "cancelled",
                  ),
                )
              }}
            >
              <Select.Option value="pending">{t("Pending")}</Select.Option>
              <Select.Option value="confirmed">{t("Confirmed")}</Select.Option>
              <Select.Option value="cancelled">{t("Cancelled")}</Select.Option>
            </Select>
          </Field>
          <Textfield
            label={t("Notes")}
            value={draft.notes}
            onChange={e => {
              dispatch(setNotes(e.target.value))
            }}
            className={styles.fullWidth}
          />
        </div>
      </div>

      {!submitState.confirming && (
        <div className={styles.actions}>
          <Button type="submit" disabled={!canSubmit}>
            {isPending
              ? (submitPendingLabel ?? t("Saving…"))
              : hasWarnings
                ? (submitWarningsLabel ?? t("Request stay (warnings present)"))
                : (submitLabel ?? t("Request stay"))}
          </Button>
          {extraActions}
        </div>
      )}

      {submitState.confirming && conflicts && (
        <ConfirmStep
          conflicts={conflicts}
          draft={draft}
          isMutating={isPending}
          onConfirm={(d: BookingDraft) => {
            submit({ kind: "confirm", draft: d })
          }}
          onCancel={() => {
            submit({ kind: "cancel" })
          }}
          roomOverCapacityDays={roomOverCapacityDays}
        />
      )}

      {submitState.error && (
        <Paragraph
          data-color="danger"
          role="alert"
          className={styles.errorMessage}
        >
          {t("Error: {{message}}", { message: submitState.error })}
        </Paragraph>
      )}
    </div>
  )
}
