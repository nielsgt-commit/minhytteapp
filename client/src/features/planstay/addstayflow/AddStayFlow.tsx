import { useMemo, useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { useSelectedUserId } from "@/selection/useSelection"
import { useFlatpickr } from "../hooks/useFlatpickr.ts"
import { useBookingForm } from "../hooks/useBookingForm.ts"
import { useOccupancyData } from "../hooks/useOccupancyData.ts"
import { useOverlappingPriorityWeeks } from "../hooks/useOverlappingPriorityWeeks.ts"
import { StepDates } from "./stepdates/StepDates.tsx"
import { StepGuests } from "./stepguests/StepGuests.tsx"
import { StepRooms } from "./steprooms/StepRooms.tsx"
import { StepConfirm } from "./stepconfirm/StepConfirm.tsx"
import { buildOccupantDots } from "../occupantDots.ts"
import styles from "./AddStayFlow.module.css"

export function AddStayFlow({
  propertyId,
  currentStep,
  onComplete,
}: {
  propertyId: number
  currentStep: number
  // Called after a stay is saved, so the page can return to the overview.
  onComplete: () => void
}) {
  const { t } = useTranslation("planstay")
  const trpc = useTRPC()
  const selectedUserId = useSelectedUserId()

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
  } = useBookingForm(propertyId, selectedUserId, { kind: "create" }, () => {
    onComplete()
  })

  // Per-day occupant dots for the calendar, colored by family group.
  const dotsByDay = useMemo(
    () => buildOccupantDots(bookings, userGroups),
    [bookings, userGroups],
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
  const otherUsers = users.filter(u => u.id !== selectedUserId)

  const occupancy = useOccupancyData({
    bookings,
    draft,
    propertyRooms,
    propertyStructures,
    conflicts,
  })

  const overlappingPriorityWeeks = useOverlappingPriorityWeeks(
    propertyId,
    draft,
  )

  return (
    <section>
      <form
        action={() => {
          submit({ kind: "submit" })
        }}
      >
        {selectedUserId == null && (
          <Paragraph role="alert">
            {t("No user selected — pick one from the header.")}
          </Paragraph>
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
          tent={occupancy.tent}
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
          submitState={submitState}
          submit={submit}
          hasWarnings={hasWarnings}
          canSubmit={canSubmit}
          isPending={isPending}
          roomOverCapacityDays={occupancy.roomOverCapacityDays}
          stepClass={styles.step}
          stepActiveClass={styles.stepActive}
        />
      </form>
    </section>
  )
}
