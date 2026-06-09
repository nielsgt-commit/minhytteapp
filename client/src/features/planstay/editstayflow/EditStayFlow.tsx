import { useMemo, useState } from "react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Button, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import type { BookingDraftRecord } from "@/features/planstay/booking-logic"
import { useBookingForm } from "../hooks/useBookingForm.ts"
import { useFlatpickr } from "../hooks/useFlatpickr.ts"
import { useOccupancyData } from "../hooks/useOccupancyData.ts"
import { StepDates } from "../addstayflow/stepdates/StepDates.tsx"
import { StepGuests } from "../addstayflow/stepguests/StepGuests.tsx"
import { StepRooms } from "../addstayflow/steprooms/StepRooms.tsx"
import { StepConfirm } from "../addstayflow/stepconfirm/StepConfirm.tsx"
import { buildOccupantDots } from "../occupantDots.ts"
import styles from "../addstayflow/AddStayFlow.module.css"

const TOTAL_STEPS = 4
// Label each "Next" button with the step it leads to.
const NEXT_STEP_LABELS = ["Add guests", "Add rooms", "Review"] as const

function isoWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dow = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay()
  const week1Mon = new Date(jan4)
  week1Mon.setUTCDate(jan4.getUTCDate() - (dow - 1))
  const target = new Date(week1Mon)
  target.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7)
  return target
}

export function EditStayFlow({
  propertyId,
  bookingId,
  initialRecord,
  onClose,
}: {
  propertyId: number
  bookingId: number
  initialRecord: BookingDraftRecord
  onClose: () => void
}) {
  const { t } = useTranslation("planstay")
  const trpc = useTRPC()

  const { data: users } = useSuspenseQuery(
    trpc.user.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: rooms } = useSuspenseQuery(
    trpc.room.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: structures } = useSuspenseQuery(
    trpc.structure.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: bookings } = useSuspenseQuery(
    trpc.booking.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: userGroups } = useSuspenseQuery(
    trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: propertyId,
    }),
  )

  const [expandedRoomId, setExpandedRoomId] = useState<number | null>(null)
  const [currentStep, setCurrentStep] = useState(1)

  const {
    draft,
    dispatch,
    conflicts,
    isFetching,
    hasWarnings,
    submitState,
    submit,
    isPending,
    canSubmit,
  } = useBookingForm(
    propertyId,
    initialRecord.booker_id,
    { kind: "edit", bookingId, initialRecord },
    onClose,
  )

  // Calendar dots show who else is around; exclude the stay being edited so
  // its own (possibly changing) dates don't double-count.
  const dotsByDay = useMemo(
    () =>
      buildOccupantDots(bookings, userGroups, { excludeBookingId: bookingId }),
    [bookings, userGroups, bookingId],
  )

  const { inputRef, rowRef, guestInputRef } = useFlatpickr(
    draft,
    dispatch,
    dotsByDay,
  )

  const propertyStructures = structures.filter(
    b => b.property_id === propertyId,
  )
  const propertyStructureIds = new Set(propertyStructures.map(b => b.id))
  const propertyRooms = rooms.filter(r =>
    propertyStructureIds.has(r.structure_id),
  )
  const otherUsers = users.filter(u => u.id !== initialRecord.booker_id)

  const occupancy = useOccupancyData({
    bookings: bookings.filter(b => b.id !== bookingId),
    draft,
    propertyRooms,
    propertyStructures,
    conflicts,
  })

  const draftYear = draft.start_date
    ? parseInt(draft.start_date.slice(0, 4))
    : new Date().getFullYear()
  const { data: priorityData } = useQuery({
    ...trpc.priority.list.queryOptions({
      property_id: propertyId,
      year: draftYear,
    }),
    enabled: draft.start_date != null && draft.end_date != null,
  })

  const overlappingPriorityWeeks = useMemo(() => {
    const startDate = draft.start_date
    const endDate = draft.end_date
    if (!startDate || !endDate || !priorityData) return []
    const ownerNameById = new Map(
      priorityData.eligibleOwners.map(o => [
        o.user_group_id,
        o.user_group_name,
      ]),
    )
    return priorityData.assignments
      .filter(a => {
        const weekStart = isoWeekMonday(a.year, a.iso_week)
        const weekEnd = new Date(weekStart)
        weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
        return (
          weekStart.toISOString().slice(0, 10) <= endDate &&
          weekEnd.toISOString().slice(0, 10) >= startDate
        )
      })
      .map(a => ({
        iso_week: a.iso_week,
        owner_name:
          ownerNameById.get(a.user_group_id) ?? `#${String(a.user_group_id)}`,
      }))
  }, [draft.start_date, draft.end_date, priorityData])

  const goToStep = (n: number) => {
    if (n < 1 || n > TOTAL_STEPS) return
    setCurrentStep(n)
  }

  return (
    <section>
      <form
        action={() => {
          submit({ kind: "submit" })
        }}
      >
        {draft.status === "cancelled" && (
          <Paragraph role="alert">{t("This stay is cancelled.")}</Paragraph>
        )}

        <StepDates
          isActive={currentStep === 1}
          rowRef={rowRef}
          inputRef={inputRef}
          totalBeds={occupancy.totalBeds}
          occupiedBeds={occupancy.occupiedBeds}
          overlappingBookings={occupancy.overlappingBookings}
          overlappingPriorityWeeks={overlappingPriorityWeeks}
          hasStartDate={draft.start_date != null}
          stepClass={styles.step}
          stepActiveClass={styles.stepActive}
        />

        <StepGuests
          isActive={currentStep === 2}
          users={users}
          otherUsers={otherUsers}
          selectedUserId={initialRecord.booker_id}
          draft={draft}
          dispatch={dispatch}
          guestInputRef={guestInputRef}
          stepClass={styles.step}
          stepActiveClass={styles.stepActive}
        />

        <StepRooms
          isActive={currentStep === 3}
          isFetching={isFetching}
          propertyStructures={propertyStructures}
          propertyRooms={propertyRooms}
          users={users}
          occupantsByRoom={occupancy.occupantsByRoom}
          existingOccupantsByRoom={occupancy.existingOccupantsByRoom}
          adultInKidOnlyByRoom={occupancy.adultInKidOnlyByRoom}
          unassigned={occupancy.unassigned}
          tent={occupancy.tent}
          draft={draft}
          dispatch={dispatch}
          selectedUserId={initialRecord.booker_id}
          expandedRoomId={expandedRoomId}
          setExpandedRoomId={setExpandedRoomId}
          conflicts={conflicts}
          stepClass={styles.step}
          stepActiveClass={styles.stepActive}
        />

        <StepConfirm
          isActive={currentStep === 4}
          draft={draft}
          dispatch={dispatch}
          users={users}
          propertyStructures={propertyStructures}
          propertyRooms={propertyRooms}
          occupantsByRoom={occupancy.occupantsByRoom}
          unassigned={occupancy.unassigned}
          conflicts={conflicts}
          submitState={submitState}
          submit={submit}
          hasWarnings={hasWarnings}
          canSubmit={canSubmit}
          isPending={isPending}
          roomOverCapacityDays={occupancy.roomOverCapacityDays}
          stepClass={styles.step}
          stepActiveClass={styles.stepActive}
          submitLabel={t("Save changes")}
          submitWarningsLabel={t("Save changes (warnings present)")}
          submitPendingLabel={t("Saving…")}
          navActions={
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  goToStep(currentStep - 1)
                }}
              >
                {t("Back")}
              </Button>
              <Button type="button" variant="tertiary" onClick={onClose}>
                {t("Close")}
              </Button>
            </>
          }
          extraActions={
            draft.status !== "cancelled" && (
              <Button
                type="button"
                variant="secondary"
                data-color="danger"
                disabled={isPending}
                onClick={() => {
                  submit({ kind: "cancel-stay" })
                }}
              >
                {t("Cancel stay")}
              </Button>
            )
          }
        />

        {currentStep < TOTAL_STEPS && (
          <div className={styles.navButtons}>
            <Button
              type="button"
              variant="secondary"
              disabled={currentStep === 1}
              onClick={() => {
                goToStep(currentStep - 1)
              }}
            >
              {t("Back")}
            </Button>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Button type="button" variant="tertiary" onClick={onClose}>
                {t("Close")}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  goToStep(currentStep + 1)
                }}
              >
                {t(NEXT_STEP_LABELS[currentStep - 1])}
              </Button>
            </div>
          </div>
        )}
      </form>
    </section>
  )
}
