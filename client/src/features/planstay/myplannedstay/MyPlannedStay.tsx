import { useSelectedPropertyId } from "@/selection/useSelection"
import { useState } from "react"
import { useQueries, useSuspenseQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Field,
  Label,
  Paragraph,
  Select,
  Tag,
} from "@digdir/designsystemet-react"
import { MenuElipsisVerticalIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { Temporal } from "temporal-polyfill"
import {
  formatDateRange,
  formatMonthYear,
  isoWeekMonday,
} from "@/utils/dateUtils"
import type { BookingDraftRecord } from "@/features/planstay/booking-logic"
import { PlanStayFlowSheet } from "@/features/planstay/planstayflowsheet/PlanStayFlowSheet.tsx"
import styles from "./MyPlannedStay.module.css"

function rangesOverlap(
  aStart: Temporal.PlainDate,
  aEnd: Temporal.PlainDate,
  bStart: Temporal.PlainDate,
  bEnd: Temporal.PlainDate,
) {
  return (
    Temporal.PlainDate.compare(aStart, bEnd) <= 0 &&
    Temporal.PlainDate.compare(bStart, aEnd) <= 0
  )
}

type BookingShape = {
  id: number
  property_id: number
  booker_id: number
  start_date: Temporal.PlainDate
  end_date: Temporal.PlainDate
  status: "pending" | "confirmed" | "cancelled"
  notes: string | null
  occupants: {
    user_id: number
    room_id: number | null
    queued: boolean
    sleeps_separately: boolean
    user_name: string | null
  }[]
}

function bookingToRecord(b: BookingShape): BookingDraftRecord {
  return {
    id: b.id,
    property_id: b.property_id,
    booker_id: b.booker_id,
    start_date: b.start_date.toString(),
    end_date: b.end_date.toString(),
    status: b.status,
    notes: b.notes,
    occupants: b.occupants.map(o => ({
      user_id: o.user_id,
      room_id: o.room_id,
      queued: o.queued,
      sleeps_separately: o.sleeps_separately,
    })),
  }
}

export function MyPlannedStay() {
  const { t, i18n } = useTranslation("dashboard")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId() ?? 0
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())
  const { data: bookings } = useSuspenseQuery(
    trpc.booking.listForProperty.queryOptions({
      property_id: selectedPropertyId,
    }),
  )
  const { data: propertyUsers } = useSuspenseQuery(
    trpc.user.listForProperty.queryOptions({ property_id: selectedPropertyId }),
  )
  const childUserIds = new Set(
    propertyUsers.filter(u => u.is_child).map(u => u.id),
  )
  const active = bookings.filter(b => b.status !== "cancelled")
  // Include stays she booked for others (booker but not occupant) so she can
  // still manage them after removing herself.
  const myBookings = active
    .filter(
      b =>
        b.occupants.some(o => o.user_id === me.id) || b.booker_id === me.id,
    )
    .sort((a, b) => Temporal.PlainDate.compare(a.start_date, b.start_date))

  type SheetTarget =
    | { kind: "create" }
    | { kind: "edit"; booking: (typeof myBookings)[number] }
  const [sheetTarget, setSheetTarget] = useState<SheetTarget | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(
    null,
  )
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<number | null>(
    null,
  )
  // Which card's kebab menu is open.
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)
  const [handOver, setHandOver] = useState<{
    bookingId: number
    newBookerId: number | null
    removeSelf: boolean
  } | null>(null)
  const updateMutation = useMutationWithInvalidation(
    trpc.booking.update.mutationOptions(),
    [trpc.booking.pathKey()],
  )
  const transferMutation = useMutationWithInvalidation(
    trpc.booking.transferBooker.mutationOptions(),
    [trpc.booking.pathKey()],
  )
  const { error: mutationError } = useMutationsStatus(
    updateMutation,
    transferMutation,
  )

  const removeSelf = (b: (typeof myBookings)[number]) => {
    updateMutation.mutate({
      id: b.id,
      property_id: b.property_id,
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
          sleeps_separately: o.sleeps_separately,
        })),
    })
  }

  // Priority weeks are assigned per ISO year, so fetch the list once per
  // distinct year the user's stays touch, then resolve overlaps client-side.
  const priorityYears = Array.from(
    new Set(myBookings.flatMap(b => [b.start_date.year, b.end_date.year])),
  )
  const priorityResults = useQueries({
    queries: priorityYears.map(year => ({
      ...trpc.priority.list.queryOptions({
        property_id: selectedPropertyId,
        year,
      }),
      enabled: selectedPropertyId > 0,
    })),
  })
  const priorityByYear = new Map(
    priorityYears.map((year, i) => [year, priorityResults[i].data]),
  )
  const priorityWeeksFor = (b: (typeof myBookings)[number]) => {
    const weeks: { iso_week: number; owner_name: string }[] = []
    for (const year of new Set([b.start_date.year, b.end_date.year])) {
      const data = priorityByYear.get(year)
      if (!data) continue
      const ownerNameById = new Map(
        data.eligibleOwners.map(o => [o.user_group_id, o.user_group_name]),
      )
      for (const a of data.assignments) {
        const weekStart = isoWeekMonday(a.year, a.iso_week)
        const weekEnd = weekStart.add({ days: 6 })
        if (
          Temporal.PlainDate.compare(weekStart, b.end_date) <= 0 &&
          Temporal.PlainDate.compare(weekEnd, b.start_date) >= 0
        ) {
          weeks.push({
            iso_week: a.iso_week,
            owner_name:
              ownerNameById.get(a.user_group_id) ??
              `#${String(a.user_group_id)}`,
          })
        }
      }
    }
    return weeks
  }

  // Temporary entry point for the alternative bottom-sheet flow. Rendered in
  // both the empty and populated states so it's reachable with zero stays.
  const flowSheet = (
    <>
      <div className={styles.toolbar}>
        <Button
          type="button"
          variant="secondary"
          data-size="sm"
          className={styles.addButton}
          onClick={() => {
            setSheetTarget({ kind: "create" })
          }}
        >
          {t("+ Add stay")}
        </Button>
      </div>
      <PlanStayFlowSheet
        propertyId={
          sheetTarget?.kind === "edit"
            ? sheetTarget.booking.property_id
            : selectedPropertyId
        }
        open={sheetTarget != null}
        onClose={() => {
          setSheetTarget(null)
        }}
        edit={
          sheetTarget?.kind === "edit"
            ? {
                bookingId: sheetTarget.booking.id,
                initialRecord: bookingToRecord(sheetTarget.booking),
              }
            : undefined
        }
      />
    </>
  )

  if (myBookings.length === 0) {
    return (
      <>
        {flowSheet}
        <EmptyState title={t("No planned stays yet.")} />
      </>
    )
  }

  type MonthGroup = {
    key: string
    label: string
    bookings: typeof myBookings
  }
  const monthGroups: MonthGroup[] = []
  for (const b of myBookings) {
    const key = b.start_date.toString().slice(0, 7) // YYYY-MM
    const lastGroup = monthGroups.at(-1)
    if (lastGroup?.key === key) {
      lastGroup.bookings.push(b)
    } else {
      monthGroups.push({
        key,
        label: formatMonthYear(b.start_date, i18n.language),
        bookings: [b],
      })
    }
  }

  return (
    <>
      {flowSheet}
      <ErrorAlert error={mutationError} />
      <div className={styles.groups}>
        {monthGroups.map(group => (
          <section key={group.key}>
            <h3 className={styles.monthHeading}>{group.label}</h3>
            <ul className={styles.list}>
              {group.bookings.map(b => {
                const companionNames = b.occupants
                  .filter(o => o.user_id !== me.id)
                  .map(o => o.user_name ?? `#${String(o.user_id)}`)
                // Others at the cabin in the same period: occupants of other
                // overlapping bookings, minus everyone already on this stay.
                // Mirrors StayAvailabilityPanel: prefer the confirmed entry
                // when someone appears both queued and confirmed, and mark
                // queued names with a trailing "?".
                const stayUserIds = new Set(b.occupants.map(o => o.user_id))
                const othersSeen = new Map<
                  number,
                  { name: string; queued: boolean }
                >()
                for (const other of active) {
                  if (other.id === b.id) continue
                  if (
                    !rangesOverlap(
                      b.start_date,
                      b.end_date,
                      other.start_date,
                      other.end_date,
                    )
                  )
                    continue
                  for (const o of other.occupants) {
                    if (o.user_id === me.id || stayUserIds.has(o.user_id))
                      continue
                    const existing = othersSeen.get(o.user_id)
                    if (!existing || (!o.queued && existing.queued)) {
                      othersSeen.set(o.user_id, {
                        name: o.user_name ?? `#${String(o.user_id)}`,
                        queued: o.queued,
                      })
                    }
                  }
                }
                const othersInPeriod = Array.from(othersSeen.values()).map(o =>
                  o.queued ? `${o.name}?` : o.name,
                )
                const isOpen = openId === b.id
                const isConfirmingDelete = confirmingDeleteId === b.id
                const isConfirmingRemove = confirmingRemoveId === b.id
                const canEdit = b.booker_id === me.id
                const meIsOccupant = b.occupants.some(
                  o => o.user_id === me.id,
                )
                const eligibleNewBookers = b.occupants.filter(
                  o => o.user_id !== me.id && !childUserIds.has(o.user_id),
                )
                const canRemoveMe = meIsOccupant && b.occupants.length >= 2
                const canHandOverBooking =
                  canEdit && eligibleNewBookers.length > 0
                const isHandingOver = handOver?.bookingId === b.id
                const priorityWeeks = priorityWeeksFor(b)
                const toggle = () => {
                  setConfirmingDeleteId(null)
                  setConfirmingRemoveId(null)
                  setHandOver(null)
                  setOpenId(prev => (prev === b.id ? null : b.id))
                }
                return (
                  <Card asChild key={b.id}>
                    <li>
                      <Card.Block
                        role="button"
                        tabIndex={0}
                        aria-expanded={isOpen}
                        onClick={toggle}
                        onKeyDown={e => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            toggle()
                          }
                        }}
                        className={styles.cardBlock}
                      >
                        <div className={styles.cardHead}>
                          <span>
                            {formatDateRange(
                              b.start_date,
                              b.end_date,
                              i18n.language,
                            )}
                          </span>
                          {priorityWeeks.length > 0 && (
                            <div className={styles.priorityTags}>
                              {priorityWeeks.map(pw => (
                                <Tag key={pw.iso_week} data-color="warning">
                                  {t("{{name}}'s week", {
                                    name: pw.owner_name,
                                  })}
                                </Tag>
                              ))}
                            </div>
                          )}
                          {(canEdit || canRemoveMe) && (
                            <span
                              className={styles.kebab}
                              onClick={e => {
                                e.stopPropagation()
                              }}
                              onKeyDown={e => {
                                e.stopPropagation()
                              }}
                            >
                              <Dropdown.TriggerContext>
                                <Dropdown.Trigger
                                  variant="tertiary"
                                  data-size="sm"
                                  icon
                                  aria-label={t("Stay actions")}
                                >
                                  <MenuElipsisVerticalIcon
                                    aria-hidden
                                    fontSize="1.25rem"
                                  />
                                </Dropdown.Trigger>
                                <Dropdown
                                  placement="bottom-end"
                                  open={menuOpenId === b.id}
                                  onOpen={() => {
                                    setMenuOpenId(b.id)
                                  }}
                                  onClose={() => {
                                    setMenuOpenId(null)
                                  }}
                                >
                                  <Dropdown.List>
                                    {canRemoveMe && (
                                      <Dropdown.Item>
                                        <Dropdown.Button
                                          onClick={() => {
                                            setMenuOpenId(null)
                                            setConfirmingDeleteId(null)
                                            setHandOver(null)
                                            setConfirmingRemoveId(b.id)
                                            setOpenId(b.id)
                                          }}
                                        >
                                          {t("Remove me")}
                                        </Dropdown.Button>
                                      </Dropdown.Item>
                                    )}
                                    {canHandOverBooking && (
                                      <Dropdown.Item>
                                        <Dropdown.Button
                                          onClick={() => {
                                            setMenuOpenId(null)
                                            setConfirmingDeleteId(null)
                                            setConfirmingRemoveId(null)
                                            setHandOver({
                                              bookingId: b.id,
                                              newBookerId:
                                                eligibleNewBookers[0].user_id,
                                              removeSelf: meIsOccupant,
                                            })
                                            setOpenId(b.id)
                                          }}
                                        >
                                          {t("Hand over booking")}
                                        </Dropdown.Button>
                                      </Dropdown.Item>
                                    )}
                                    {canEdit && (
                                      <Dropdown.Item>
                                        <Dropdown.Button
                                          data-color="danger"
                                          onClick={() => {
                                            setMenuOpenId(null)
                                            setConfirmingRemoveId(null)
                                            setHandOver(null)
                                            setConfirmingDeleteId(b.id)
                                            setOpenId(b.id)
                                          }}
                                        >
                                          {t("Delete stay")}
                                        </Dropdown.Button>
                                      </Dropdown.Item>
                                    )}
                                  </Dropdown.List>
                                </Dropdown>
                              </Dropdown.TriggerContext>
                            </span>
                          )}
                        </div>
                        {isOpen && (
                          <>
                            <div className={styles.companions}>
                              {!meIsOccupant && (
                                <Tag data-color="warning">
                                  {t("You're not staying yourself")}
                                </Tag>
                              )}
                              {companionNames.length > 0 ? (
                                <>
                                  <span>{t("With:")}</span>
                                  {companionNames.map(n => (
                                    <Tag key={n} data-color="info">
                                      {n}
                                    </Tag>
                                  ))}
                                </>
                              ) : (
                                meIsOccupant && <span>{t("Solo stay")}</span>
                              )}
                            </div>
                            {othersInPeriod.length > 0 && (
                              <div className={styles.companions}>
                                <span>{t("During this period:")}</span>
                                {othersInPeriod.map(n => (
                                  <Tag key={n} data-color="neutral">
                                    {n}
                                  </Tag>
                                ))}
                              </div>
                            )}
                            {!canEdit && (
                              <div className={styles.companions}>
                                <span>{t("Booked by:")}</span>
                                <Tag data-color="neutral">
                                  {b.booker_name ?? `#${String(b.booker_id)}`}
                                </Tag>
                              </div>
                            )}
                            {canEdit && isHandingOver && (
                              <div
                                className={styles.handOver}
                                onClick={e => {
                                  e.stopPropagation()
                                }}
                                onKeyDown={e => {
                                  e.stopPropagation()
                                }}
                              >
                                <Field>
                                  <Label>{t("New booker")}</Label>
                                  <Select
                                    value={
                                      handOver.newBookerId != null
                                        ? String(handOver.newBookerId)
                                        : ""
                                    }
                                    onChange={e => {
                                      setHandOver({
                                        ...handOver,
                                        newBookerId:
                                          e.target.value === ""
                                            ? null
                                            : Number(e.target.value),
                                      })
                                    }}
                                  >
                                    {eligibleNewBookers.map(o => (
                                      <Select.Option
                                        key={o.user_id}
                                        value={String(o.user_id)}
                                      >
                                        {o.user_name ?? `#${String(o.user_id)}`}
                                      </Select.Option>
                                    ))}
                                  </Select>
                                </Field>
                                {meIsOccupant && (
                                  <Checkbox
                                    label={t("Also remove me from the stay")}
                                    checked={handOver.removeSelf}
                                    onChange={e => {
                                      setHandOver({
                                        ...handOver,
                                        removeSelf: e.target.checked,
                                      })
                                    }}
                                  />
                                )}
                              </div>
                            )}
                            <div className={styles.actions}>
                              {isConfirmingRemove ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="tertiary"
                                    disabled={updateMutation.isPending}
                                    onClick={e => {
                                      e.stopPropagation()
                                      setConfirmingRemoveId(null)
                                    }}
                                  >
                                    {t("Cancel")}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="primary"
                                    data-color="danger"
                                    disabled={updateMutation.isPending}
                                    onClick={e => {
                                      e.stopPropagation()
                                      setConfirmingRemoveId(null)
                                      removeSelf(b)
                                    }}
                                  >
                                    {t("Confirm remove")}
                                  </Button>
                                </>
                              ) : canEdit ? (
                                isConfirmingDelete ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="tertiary"
                                      disabled={updateMutation.isPending}
                                      onClick={e => {
                                        e.stopPropagation()
                                        setConfirmingDeleteId(null)
                                      }}
                                    >
                                      {t("Cancel")}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="primary"
                                      data-color="danger"
                                      disabled={updateMutation.isPending}
                                      onClick={e => {
                                        e.stopPropagation()
                                        setConfirmingDeleteId(null)
                                        updateMutation.mutate({
                                          id: b.id,
                                          property_id: b.property_id,
                                          start_date: b.start_date,
                                          end_date: b.end_date,
                                          status: "cancelled",
                                          notes: b.notes,
                                          occupants: b.occupants.map(o => ({
                                            user_id: o.user_id,
                                            room_id: o.room_id,
                                            queued: o.queued,
                                            sleeps_separately:
                                              o.sleeps_separately,
                                          })),
                                        })
                                      }}
                                    >
                                      {t("Confirm delete")}
                                    </Button>
                                  </>
                                ) : isHandingOver ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="tertiary"
                                      disabled={transferMutation.isPending}
                                      onClick={e => {
                                        e.stopPropagation()
                                        setHandOver(null)
                                      }}
                                    >
                                      {t("Cancel")}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="primary"
                                      disabled={
                                        handOver.newBookerId == null ||
                                        transferMutation.isPending
                                      }
                                      onClick={e => {
                                        e.stopPropagation()
                                        if (handOver.newBookerId == null) return
                                        transferMutation.mutate({
                                          property_id: b.property_id,
                                          id: b.id,
                                          new_booker_id: handOver.newBookerId,
                                          remove_self:
                                            handOver.removeSelf &&
                                            meIsOccupant,
                                        })
                                        setHandOver(null)
                                      }}
                                    >
                                      {t("Hand over")}
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={e => {
                                      e.stopPropagation()
                                      setSheetTarget({
                                        kind: "edit",
                                        booking: b,
                                      })
                                    }}
                                  >
                                    {t("Edit stay")}
                                  </Button>
                                )
                              ) : canRemoveMe ? null : (
                                <Paragraph>
                                  {t(
                                    "You're the only guest — ask {{name}} to cancel the stay instead.",
                                    {
                                      name:
                                        b.booker_name ??
                                        `#${String(b.booker_id)}`,
                                    },
                                  )}
                                </Paragraph>
                              )}
                            </div>
                          </>
                        )}
                      </Card.Block>
                    </li>
                  </Card>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
