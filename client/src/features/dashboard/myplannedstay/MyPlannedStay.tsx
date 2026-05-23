import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { Suspense, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button, Card, Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import type { BookingDraftRecord } from "@/features/calendar/booking-logic"
import { EditStayFlow } from "@/features/calendar/editstayflow/EditStayFlow.tsx"
import styles from "./MyPlannedStay.module.css"

function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) {
  return aStart <= bEnd && bStart <= aEnd
}

function formatDayMonth(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
}

type BookingShape = {
  id: number
  property_id: number
  booker_id: number
  start_date: string
  end_date: string
  status: "pending" | "confirmed" | "cancelled"
  notes: string | null
  occupants: { user_id: number; room_id: number | null; queued: boolean; user_name: string | null }[]
}

function bookingToRecord(b: BookingShape): BookingDraftRecord {
  return {
    id: b.id,
    property_id: b.property_id,
    booker_id: b.booker_id,
    start_date: b.start_date,
    end_date: b.end_date,
    status: b.status,
    notes: b.notes,
    occupants: b.occupants.map(o => ({
      user_id: o.user_id,
      room_id: o.room_id,
      queued: o.queued,
    })),
  }
}

export function MyPlannedStay() {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useSelectedPropertyId()
  const { data: me } = useQuery(trpc.user.me.queryOptions())
  const { data: bookings } = useQuery(
    trpc.booking.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )
  const [openId, setOpenId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const removeMeMutation = useMutation(
    trpc.booking.update.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.booking.pathKey() })
      },
    }),
  )

  if (selectedPropertyId == null) {
    return <p>{t("Select a property to see your stays.")}</p>
  }

  if (!me || !bookings) return <p>{t("Loading…")}</p>

  const active = bookings.filter(b => b.status !== "cancelled")
  const myBookings = active.filter(b =>
    b.occupants.some(o => o.user_id === me.id),
  )

  if (myBookings.length === 0) {
    return <p>{t("No planned stays yet.")}</p>
  }

  return (
    <ul className={styles.list}>
      {myBookings.map(b => {
        const otherNames = new Set<string>()
        for (const other of active) {
          if (!rangesOverlap(b.start_date, b.end_date, other.start_date, other.end_date)) continue
          for (const o of other.occupants) {
            if (o.user_id === me.id) continue
            otherNames.add(o.user_name ?? `#${String(o.user_id)}`)
          }
        }
        const names = Array.from(otherNames)
        const isOpen = openId === b.id
        const isEditing = editingId === b.id
        const canEdit = b.booker_id === me.id
        const toggle = () => {
          if (isEditing) return
          setOpenId(prev => (prev === b.id ? null : b.id))
        }
        return (


          <Card asChild key={b.id}>
            <li>
              <Card.Block
                role={isEditing ? undefined : "button"}
                tabIndex={isEditing ? undefined : 0}
                aria-expanded={isEditing ? undefined : isOpen}
                onClick={isEditing ? undefined : toggle}
                onKeyDown={isEditing ? undefined : e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    toggle()
                  }
                }}
                className={styles.cardBlock}
              >
                <div>
                  {formatDayMonth(b.start_date)} – {formatDayMonth(b.end_date)}
                </div>
                {isOpen && !isEditing && (
                  <>
                    <div className={styles.companions}>
                      {names.length > 0 ? (
                        <>
                          <span>{t("Accompanied by:")}</span>
                          {names.map(n => (
                            <Tag key={n} data-color="info">{n}</Tag>
                          ))}
                        </>
                      ) : (
                        <span>{t("Solo stay")}</span>
                      )}
                    </div>
                    {!canEdit && (
                      <div className={styles.companions}>
                        <span>{t("Booked by:")}</span>
                        <Tag data-color="neutral">
                          {b.booker_name ?? `#${String(b.booker_id)}`}
                        </Tag>
                      </div>
                    )}
                    <div className={styles.actions}>
                      {canEdit ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={e => {
                            e.stopPropagation()
                            setEditingId(b.id)
                          }}
                        >
                          {t("Edit stay")}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          data-color="danger"
                          disabled={removeMeMutation.isPending}
                          onClick={e => {
                            e.stopPropagation()
                            removeMeMutation.mutate({
                              id: b.id,
                              property_id: b.property_id,
                              booker_id: b.booker_id,
                              start_date: b.start_date,
                              end_date: b.end_date,
                              status: b.status,
                              notes: b.notes,
                              occupants: b.occupants
                                .filter(o => o.user_id !== me.id)
                                .map(o => ({
                                  user_id: o.user_id,
                                  room_id: o.room_id,
                                  queued: o.queued,
                                })),
                            })
                          }}
                        >
                          {t("Remove me")}
                        </Button>
                      )}
                    </div>
                  </>
                )}
                {isEditing && (
                  <div
                    className={styles.editPanel}
                    onClick={e => { e.stopPropagation() }}
                    onKeyDown={e => { e.stopPropagation() }}
                  >
                    <Suspense fallback={<p>{t("Loading…")}</p>}>
                      <EditStayFlow
                        propertyId={b.property_id}
                        bookingId={b.id}
                        initialRecord={bookingToRecord(b)}
                        onClose={() => { setEditingId(null) }}
                      />
                    </Suspense>
                  </div>
                )}
              </Card.Block>
            </li>
          </Card>

          )
      })}
    </ul>
  )
}
