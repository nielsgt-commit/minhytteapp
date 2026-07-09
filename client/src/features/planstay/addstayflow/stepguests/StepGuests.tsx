import type { Dispatch, RefObject } from "react"
import {
  Card,
  Checkbox,
  Field,
  Heading,
  Label,
  Tag,
  EXPERIMENTAL_Suggestion as Suggestion,
} from "@digdir/designsystemet-react"
import type { SuggestionItem } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { addOccupant, removeOccupant } from "@/features/planstay/booking-logic"
import type {
  BookingDraft,
  BookingDraftAction,
} from "@/features/planstay/booking-logic"
import styles from "./StepGuests.module.css"

type User = { id: number; name: string; is_child: boolean | null }

export function StepGuests({
  isActive,
  users,
  otherUsers,
  selectedUserId,
  draft,
  dispatch,
  guestInputRef,
  stepClass,
  stepActiveClass,
  heading,
  description,
}: {
  isActive: boolean
  users: User[]
  otherUsers: User[]
  selectedUserId: number | null
  draft: BookingDraft
  dispatch: Dispatch<BookingDraftAction>
  guestInputRef: RefObject<HTMLInputElement | null>
  stepClass: string
  stepActiveClass: string
  heading?: string
  description?: string
}) {
  const { t } = useTranslation("planstay")
  const bookerStaying =
    selectedUserId != null &&
    draft.occupants.some(o => o.user_id === selectedUserId)
  return (
    <div className={`${stepClass} ${isActive ? stepActiveClass : ""}`}>
      <Card className={styles.card}>
        <Card.Block>
          <div className={styles.headingRow}>
            <Heading level={4}>{heading ?? t("Guests")}</Heading>
            {draft.start_date && draft.end_date && (
              <Tag data-color="info">
                {draft.start_date} → {draft.end_date}
              </Tag>
            )}
          </div>

          <Field>
            <Label>{description ?? t("Add guests")}</Label>
            <Suggestion
              multiple
              selected={draft.occupants.map(o => {
                const u = users.find(x => x.id === o.user_id)
                const isBooker = o.user_id === selectedUserId
                return {
                  value: String(o.user_id),
                  label: u
                    ? `${u.name}${isBooker ? t(" (you)") : ""}${u.is_child ? t(" (child)") : ""}`
                    : `#${String(o.user_id)}`,
                }
              })}
              onSelectedChange={(newItems: SuggestionItem[]) => {
                const newIds = new Set(newItems.map(i => Number(i.value)))
                const currentIds = new Set(draft.occupants.map(o => o.user_id))
                let added = false
                for (const item of newItems) {
                  const uid = Number(item.value)
                  if (!currentIds.has(uid)) {
                    dispatch(addOccupant(uid, null))
                    added = true
                  }
                }
                for (const uid of currentIds) {
                  // The booker is always part of the stay — never remove them.
                  if (uid === selectedUserId) continue
                  if (!newIds.has(uid)) dispatch(removeOccupant(uid))
                }
                if (added && guestInputRef.current) {
                  guestInputRef.current.value = ""
                  guestInputRef.current.dispatchEvent(
                    new Event("input", { bubbles: true }),
                  )
                }
              }}
            >
              <Suggestion.Input
                ref={guestInputRef}
                placeholder={t("Search guests…")}
              />
              <Suggestion.Clear />
              <Suggestion.List>
                <Suggestion.Empty>{t("No guests found")}</Suggestion.Empty>
                {otherUsers.map(u => (
                  <Suggestion.Option key={u.id} value={String(u.id)}>
                    {u.name}
                    {u.is_child ? t(" (child)") : ""}
                  </Suggestion.Option>
                ))}
              </Suggestion.List>
            </Suggestion>
          </Field>

          <Checkbox
            label={t("I'm booking for others — I'm not staying myself")}
            checked={selectedUserId != null && !bookerStaying}
            onChange={e => {
              if (selectedUserId == null) return
              if (e.target.checked) {
                dispatch(removeOccupant(selectedUserId))
              } else {
                dispatch(addOccupant(selectedUserId, null))
              }
            }}
          />
        </Card.Block>
      </Card>
    </div>
  )
}
