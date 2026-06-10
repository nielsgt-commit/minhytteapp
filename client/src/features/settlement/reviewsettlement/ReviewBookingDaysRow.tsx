import { useState } from "react"
import {
  Button,
  Card,
  Heading,
  Paragraph,
  Switch,
  Tag,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./ReviewBookingDays.module.css"
import {
  type DraftOccupant,
  EditActions,
  EditDates,
  OccupantChipInput,
  type UserOption,
} from "./ReviewBookingDaysRowEditor"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { formatDateRange, inclusiveDayCount } from "@/utils/dateUtils"

type BookingOccupant = {
  user_id: number
  user_name: string | null
  room_id: number | null
}

type Booking = {
  id: number
  property_id: number | null
  booker_id: number
  booker_name: string | null
  start_date: string
  end_date: string
  status: "pending" | "confirmed" | "cancelled"
  notes: string | null
  occupants: BookingOccupant[]
}

// Draft state for an in-progress edit; null when the row is read-only.
type EditState = {
  start: string
  end: string
  drafts: DraftOccupant[]
  inputValue: string
}

function buildDrafts(b: Booking, extras: string[]): DraftOccupant[] {
  return [
    ...b.occupants.map(o => ({
      kind: "user" as const,
      user_id: o.user_id,
      name: o.user_name ?? `#${String(o.user_id)}`,
      room_id: o.room_id,
    })),
    ...extras.map(name => ({ kind: "guest" as const, name })),
  ]
}

function commitOccupantInput(
  inputValue: string,
  drafts: DraftOccupant[],
  users: UserOption[],
): { drafts: DraftOccupant[]; inputValue: string } {
  const trimmed = inputValue.trim()
  if (trimmed === "") return { drafts, inputValue }
  const match = users.find(u => u.name.toLowerCase() === trimmed.toLowerCase())
  const next: DraftOccupant = match
    ? {
        kind: "user",
        user_id: match.id,
        name: match.name,
        room_id: null,
      }
    : { kind: "guest", name: trimmed }
  if (
    next.kind === "user" &&
    drafts.some(d => d.kind === "user" && d.user_id === next.user_id)
  ) {
    return { drafts, inputValue: "" }
  }
  return { drafts: [...drafts, next], inputValue: "" }
}

export function ReviewBookingDaysRow({
  settlementId,
  booking,
  users,
  excluded,
  extras,
}: {
  settlementId: number
  booking: Booking
  users: UserOption[]
  excluded: boolean
  extras: string[]
}) {
  const { t, i18n } = useTranslation("settlement")
  const trpc = useTRPC()

  const [edit, setEdit] = useState<EditState | null>(null)
  const editing = edit != null

  const updateBooking = useMutationWithInvalidation(
    trpc.booking.update.mutationOptions({
      onSuccess: () => {
        setEdit(null)
      },
    }),
    [trpc.booking.pathKey()],
  )

  const setExcluded = useMutationWithInvalidation(
    trpc.settlement.setBookingExcluded.mutationOptions(),
    [trpc.settlement.getBookingAdjustments.queryKey()],
  )

  const setExtras = useMutationWithInvalidation(
    trpc.settlement.setBookingExtras.mutationOptions(),
    [trpc.settlement.getBookingAdjustments.queryKey()],
  )

  const status = useMutationsStatus(updateBooking, setExcluded, setExtras)

  const enterEdit = () => {
    setEdit({
      start: booking.start_date,
      end: booking.end_date,
      drafts: buildDrafts(booking, extras),
      inputValue: "",
    })
  }

  const cancelEdit = () => {
    setEdit(null)
  }

  const removeDraftAt = (index: number) => {
    setEdit(e =>
      e == null ? e : { ...e, drafts: e.drafts.filter((_, i) => i !== index) },
    )
  }

  const commitInput = () => {
    setEdit(e => {
      if (e == null) return e
      const next = commitOccupantInput(e.inputValue, e.drafts, users)
      return { ...e, drafts: next.drafts, inputValue: next.inputValue }
    })
  }

  const save = () => {
    if (edit == null) return
    if (booking.property_id == null) return
    const userOccupants = edit.drafts.filter(
      (d): d is Extract<DraftOccupant, { kind: "user" }> => d.kind === "user",
    )
    const guestNames = edit.drafts
      .filter(
        (d): d is Extract<DraftOccupant, { kind: "guest" }> =>
          d.kind === "guest",
      )
      .map(d => d.name)
    if (!userOccupants.some(u => u.user_id === booking.booker_id)) return
    if (edit.start > edit.end) return

    updateBooking.mutate(
      {
        id: booking.id,
        property_id: booking.property_id,
        start_date: edit.start,
        end_date: edit.end,
        status: booking.status,
        notes: booking.notes ?? undefined,
        occupants: userOccupants.map(u => ({
          user_id: u.user_id,
          room_id: u.room_id ?? undefined,
        })),
      },
      {
        onSuccess: () => {
          setExtras.mutate({
            settlementId,
            bookingId: booking.id,
            names: guestNames,
          })
        },
      },
    )
  }

  const days = inclusiveDayCount(
    edit?.start ?? booking.start_date,
    edit?.end ?? booking.end_date,
  )
  const occupantsCount = edit
    ? edit.drafts.length
    : booking.occupants.length + extras.length
  const included = !excluded
  const datalistId = `booking-occupants-${String(booking.id)}`
  const bookerMissing =
    edit != null &&
    !edit.drafts.some(d => d.kind === "user" && d.user_id === booking.booker_id)

  return (
    <Card asChild>
      <article>
        <Card.Block data-size="sm">
          {edit != null ? (
            <EditDates
              draftStart={edit.start}
              draftEnd={edit.end}
              onChangeStart={v => {
                setEdit(e => (e == null ? e : { ...e, start: v }))
              }}
              onChangeEnd={v => {
                setEdit(e => (e == null ? e : { ...e, end: v }))
              }}
            />
          ) : (
            <Heading level={4} data-size="2xs">
              {formatDateRange(
                booking.start_date,
                booking.end_date,
                i18n.language,
              )}
            </Heading>
          )}
        </Card.Block>
        <Card.Block data-size="sm">
          <div className={styles.body}>
            <Paragraph data-size="sm">
              {t("Booked by")}{" "}
              <Tag data-color="info" data-size="sm">
                {booking.booker_name ?? `#${String(booking.booker_id)}`}
              </Tag>
            </Paragraph>
            {edit != null ? (
              <OccupantChipInput
                drafts={edit.drafts}
                inputValue={edit.inputValue}
                setInputValue={v => {
                  setEdit(e => (e == null ? e : { ...e, inputValue: v }))
                }}
                users={users}
                datalistId={datalistId}
                onRemoveAt={removeDraftAt}
                onCommit={commitInput}
              />
            ) : (
              <div className={styles.occupants}>
                <Paragraph data-size="sm">{t("Occupants:")}</Paragraph>
                {booking.occupants.map(o => (
                  <Tag
                    key={`u-${String(booking.id)}-${String(o.user_id)}`}
                    data-color="neutral"
                    data-size="sm"
                  >
                    {o.user_name ?? `#${String(o.user_id)}`}
                  </Tag>
                ))}
                {extras.map((name, i) => (
                  <Tag
                    key={`g-${String(booking.id)}-${String(i)}`}
                    data-color="warning"
                    data-size="sm"
                  >
                    {name}
                  </Tag>
                ))}
              </div>
            )}
            <Paragraph data-size="sm">
              {t("{{days}} days × {{occupantsCount}} {{occupantLabel}} = ", {
                days: String(days),
                occupantsCount: String(occupantsCount),
                occupantLabel:
                  occupantsCount === 1 ? t("occupant") : t("occupants"),
              })}
              <strong>
                {t("{{count}} booking days", { count: days * occupantsCount })}
              </strong>
            </Paragraph>
            {bookerMissing && (
              <Paragraph role="alert" data-size="sm">
                {t("Booker must remain among the occupants.")}
              </Paragraph>
            )}
            <ErrorAlert error={status.error} />
          </div>
        </Card.Block>
        <Card.Block data-size="sm">
          <div className={styles.actions}>
            <Switch
              label={included ? t("Included") : t("Excluded")}
              position="end"
              data-size="sm"
              checked={included}
              disabled={setExcluded.isPending}
              onChange={e => {
                setExcluded.mutate({
                  settlementId,
                  bookingId: booking.id,
                  excluded: !e.target.checked,
                })
              }}
            />
            {editing ? (
              <EditActions
                onSave={save}
                onCancel={cancelEdit}
                saving={updateBooking.isPending}
                bookerMissing={bookerMissing}
              />
            ) : (
              <Button
                variant="tertiary"
                data-size="sm"
                type="button"
                onClick={() => {
                  enterEdit()
                }}
              >
                {t("Edit")}
              </Button>
            )}
          </div>
        </Card.Block>
      </article>
    </Card>
  )
}
