import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Button,
  Card,
  Chip,
  Heading,
  Paragraph,
  Switch,
  Tag,
} from "@digdir/designsystemet-react"
import styles from "./ReviewBookingDays.module.css"
import { useTRPC } from "@/trpc/trpc"

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

type UserOption = { id: number; name: string }

type DraftOccupant =
  | { kind: "user"; user_id: number; name: string; room_id: number | null }
  | { kind: "guest"; name: string }

function inclusiveDayCount(startIso: string, endIso: string) {
  const s = Date.parse(`${startIso}T00:00:00Z`)
  const e = Date.parse(`${endIso}T00:00:00Z`)
  return Math.round((e - s) / 86400000) + 1
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
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
  const trpc = useTRPC()
  const qc = useQueryClient()

  const [editing, setEditing] = useState(false)
  const [draftStart, setDraftStart] = useState(booking.start_date)
  const [draftEnd, setDraftEnd] = useState(booking.end_date)
  const [drafts, setDrafts] = useState<DraftOccupant[]>(() =>
    buildDrafts(booking, extras),
  )
  const [inputValue, setInputValue] = useState("")

  const updateBooking = useMutation(
    trpc.booking.update.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.booking.pathKey() })
        setEditing(false)
      },
    }),
  )

  const setExcluded = useMutation(
    trpc.settlement.setBookingExcluded.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({
          queryKey: trpc.settlement.getBookingAdjustments.queryKey(),
        })
      },
    }),
  )

  const setExtras = useMutation(
    trpc.settlement.setBookingExtras.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({
          queryKey: trpc.settlement.getBookingAdjustments.queryKey(),
        })
      },
    }),
  )

  const enterEdit = () => {
    setDraftStart(booking.start_date)
    setDraftEnd(booking.end_date)
    setDrafts(buildDrafts(booking, extras))
    setInputValue("")
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setInputValue("")
  }

  const removeDraftAt = (index: number) => {
    setDrafts(drafts.filter((_, i) => i !== index))
  }

  const commitInput = () => {
    const trimmed = inputValue.trim()
    if (trimmed === "") return
    const match = users.find(
      u => u.name.toLowerCase() === trimmed.toLowerCase(),
    )
    const next: DraftOccupant = match
      ? {
          kind: "user",
          user_id: match.id,
          name: match.name,
          room_id: null,
        }
      : { kind: "guest", name: trimmed }
    if (
      next.kind === "user"
      && drafts.some(d => d.kind === "user" && d.user_id === next.user_id)
    ) {
      setInputValue("")
      return
    }
    setDrafts([...drafts, next])
    setInputValue("")
  }

  const save = () => {
    if (booking.property_id == null) return
    const userOccupants = drafts.filter(
      (d): d is Extract<DraftOccupant, { kind: "user" }> => d.kind === "user",
    )
    const guestNames = drafts
      .filter((d): d is Extract<DraftOccupant, { kind: "guest" }> =>
        d.kind === "guest",
      )
      .map(d => d.name)
    if (!userOccupants.some(u => u.user_id === booking.booker_id)) return
    if (draftStart > draftEnd) return

    updateBooking.mutate(
      {
        id: booking.id,
        property_id: booking.property_id,
        booker_id: booking.booker_id,
        start_date: draftStart,
        end_date: draftEnd,
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
    editing ? draftStart : booking.start_date,
    editing ? draftEnd : booking.end_date,
  )
  const occupantsCount = editing ? drafts.length : booking.occupants.length + extras.length
  const included = !excluded
  const datalistId = `booking-occupants-${String(booking.id)}`
  const bookerMissing =
    editing
    && !drafts.some(d => d.kind === "user" && d.user_id === booking.booker_id)

  return (
    <Card asChild>
      <article>
        <Card.Block data-size="sm">
          {editing ? (
            <div className={styles.editDates}>
              <label className={styles.dateField}>
                <span>From</span>
                <input
                  type="date"
                  value={draftStart}
                  onChange={e => { setDraftStart(e.target.value) }}
                />
              </label>
              <label className={styles.dateField}>
                <span>To</span>
                <input
                  type="date"
                  value={draftEnd}
                  max={undefined}
                  min={draftStart}
                  onChange={e => { setDraftEnd(e.target.value) }}
                />
              </label>
            </div>
          ) : (
            <Heading level={4} data-size="2xs">
              {formatDate(booking.start_date)} – {formatDate(booking.end_date)}
            </Heading>
          )}
        </Card.Block>
        <Card.Block data-size="sm">
          <div className={styles.body}>
            <Paragraph data-size="sm">
              Booked by{" "}
              <Tag data-color="info" data-size="sm">
                {booking.booker_name ?? `#${String(booking.booker_id)}`}
              </Tag>
            </Paragraph>
            {editing ? (
              <div className={styles.chipInput}>
                {drafts.map((d, i) => (
                  <span
                    key={`${d.kind}-${d.kind === "user" ? String(d.user_id) : d.name}-${String(i)}`}
                    data-color={d.kind === "user" ? "neutral" : "warning"}
                    className={styles.chipWrap}
                  >
                    <Chip.Removable
                      aria-label={`Remove ${d.name}`}
                      data-size="sm"
                      onClick={() => { removeDraftAt(i) }}
                    >
                      {d.name}
                    </Chip.Removable>
                  </span>
                ))}
                <input
                  className={styles.chipInputField}
                  type="text"
                  list={datalistId}
                  value={inputValue}
                  placeholder="Add occupant…"
                  onChange={e => { setInputValue(e.target.value) }}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault()
                      commitInput()
                    } else if (
                      e.key === "Backspace"
                      && inputValue === ""
                      && drafts.length > 0
                    ) {
                      e.preventDefault()
                      removeDraftAt(drafts.length - 1)
                    }
                  }}
                  onBlur={() => { commitInput() }}
                />
                <datalist id={datalistId}>
                  {users.map(u => (
                    <option key={u.id} value={u.name} />
                  ))}
                </datalist>
              </div>
            ) : (
              <div className={styles.occupants}>
                <Paragraph data-size="sm">Occupants:</Paragraph>
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
              {String(days)} days × {String(occupantsCount)}{" "}
              {occupantsCount === 1 ? "occupant" : "occupants"}
              {" = "}
              <strong>{String(days * occupantsCount)} booking days</strong>
            </Paragraph>
            {bookerMissing && (
              <Paragraph role="alert" data-size="sm">
                Booker must remain among the occupants.
              </Paragraph>
            )}
            {updateBooking.error && (
              <Paragraph role="alert" data-size="sm">
                Error: {updateBooking.error.message}
              </Paragraph>
            )}
          </div>
        </Card.Block>
        <Card.Block data-size="sm">
          <div className={styles.actions}>
            <Switch
              label={included ? "Included" : "Excluded"}
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
              <div className={styles.editButtons}>
                <Button
                  variant="secondary"
                  data-size="sm"
                  type="button"
                  onClick={() => { save() }}
                  disabled={updateBooking.isPending || bookerMissing}
                >
                  Save
                </Button>
                <Button
                  variant="tertiary"
                  data-size="sm"
                  type="button"
                  onClick={() => { cancelEdit() }}
                  disabled={updateBooking.isPending}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="tertiary"
                data-size="sm"
                type="button"
                onClick={() => { enterEdit() }}
              >
                Edit
              </Button>
            )}
          </div>
        </Card.Block>
      </article>
    </Card>
  )
}
