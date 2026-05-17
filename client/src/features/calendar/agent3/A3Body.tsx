import { useState } from "react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Button, Paragraph } from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedUserId } from "@/features/user/userSlice"
import { useFlatpickr } from "./hooks/useFlatpickr"
import { useBookingForm } from "./hooks/useBookingForm"
import { useOccupancyData } from "./hooks/useOccupancyData"
import { StepDates } from "./StepDates"
import { StepGuests } from "./StepGuests"
import { StepRooms } from "./StepRooms"
import { StepConfirm } from "./StepConfirm"
import styles from "./A3Body.module.css"

const STEP_LABELS = ["Dates", "Guests", "Rooms", "Confirm"] as const
const TOTAL_STEPS = STEP_LABELS.length

function isoWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dow = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay()
  const week1Mon = new Date(jan4)
  week1Mon.setUTCDate(jan4.getUTCDate() - (dow - 1))
  const target = new Date(week1Mon)
  target.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7)
  return target
}

export function A3Body({ propertyId }: { propertyId: number }) {
  const trpc = useTRPC()
  const selectedUserId = useAppSelector(selectSelectedUserId)

  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())
  const { data: rooms } = useSuspenseQuery(trpc.room.list.queryOptions())
  const { data: structures } = useSuspenseQuery(trpc.structure.list.queryOptions())
  const { data: bookings } = useSuspenseQuery(
    trpc.booking.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const [expandedRoomId, setExpandedRoomId] = useState<number | null>(null)
  const [currentStep, setCurrentStep] = useState(1)

  const {
    draft, dispatch, confirmStep, setConfirmStep, submitError, conflicts,
    isFetching, hasWarnings, doMutate, handleSubmit, canSubmit, isPending,
  } = useBookingForm(propertyId, selectedUserId, () => { setCurrentStep(1) })

  const { inputRef, rowRef, guestInputRef } = useFlatpickr(draft, dispatch)

  const propertyStructures = structures.filter(b => b.property_id === propertyId)
  const propertyStructureIds = new Set(propertyStructures.map(b => b.id))
  const propertyRooms = rooms.filter(r => propertyStructureIds.has(r.structure_id))
  const otherUsers = users.filter(u => u.id !== selectedUserId)

  const occupancy = useOccupancyData({ bookings, draft, propertyRooms, propertyStructures, conflicts })

  const draftYear = draft.start_date ? parseInt(draft.start_date.slice(0, 4)) : new Date().getFullYear()
  const { data: priorityData } = useQuery({
    ...trpc.priority.list.queryOptions({ property_id: propertyId, year: draftYear }),
    enabled: draft.start_date != null && draft.end_date != null,
  })

  const overlappingPriorityWeeks = (() => {
    if (!draft.start_date || !draft.end_date || !priorityData) return []
    const ownerNameById = new Map(priorityData.eligibleOwners.map(o => [o.property_owner_id, o.user_name]))
    return priorityData.assignments
      .filter(a => {
        const weekStart = isoWeekMonday(a.year, a.iso_week)
        const weekEnd = new Date(weekStart)
        weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
        return weekStart.toISOString().slice(0, 10) <= draft.end_date! && weekEnd.toISOString().slice(0, 10) >= draft.start_date!
      })
      .map(a => ({ iso_week: a.iso_week, owner_name: ownerNameById.get(a.property_owner_id) ?? `#${String(a.property_owner_id)}` }))
  })()

  const goToStep = (n: number) => {
    if (n < 1 || n > TOTAL_STEPS) return
    setCurrentStep(n)
  }

  return (
    <section>
      <nav className={styles.stepper} aria-label="Booking steps">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1
          const isActive = stepNum === currentStep
          return (
            <Button
              key={label}
              type="button"
              variant="tertiary"
              className={`${styles.stepperItem} ${isActive ? styles.stepperItemActive : ""}`}
              onClick={() => { goToStep(stepNum) }}
              aria-current={isActive ? "step" : undefined}
            >
              <span className={styles.stepperBadge}>{stepNum}</span>
              <span>{label}</span>
            </Button>
          )
        })}
      </nav>

      {selectedUserId == null && (
        <Paragraph role="alert">No user selected — pick one from the header.</Paragraph>
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
        selectedUserId={selectedUserId}
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
        draft={draft}
        dispatch={dispatch}
        selectedUserId={selectedUserId}
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
        confirmStep={confirmStep}
        setConfirmStep={setConfirmStep}
        submitError={submitError}
        hasWarnings={hasWarnings}
        canSubmit={canSubmit}
        isPending={isPending}
        handleSubmit={handleSubmit}
        doMutate={doMutate}
        roomOverCapacityDays={occupancy.roomOverCapacityDays}
        stepClass={styles.step}
        stepActiveClass={styles.stepActive}
      />

      <div className={styles.navButtons}>
        <Button
          variant="secondary"
          disabled={currentStep === 1}
          onClick={() => { goToStep(currentStep - 1) }}
        >
          Back
        </Button>
        {currentStep < TOTAL_STEPS && (
          <Button onClick={() => { goToStep(currentStep + 1) }}>
            Next
          </Button>
        )}
      </div>
    </section>
  )
}
