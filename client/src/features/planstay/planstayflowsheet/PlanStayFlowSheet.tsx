import { useMemo, useRef, useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Dialog, Heading, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { useSelectedUserId } from "@/selection/useSelection"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import { useSingleDateFlatpickr } from "../hooks/useSingleDateFlatpickr.ts"
import { useBookingForm } from "../hooks/useBookingForm.ts"
import { useOccupancyData } from "../hooks/useOccupancyData.ts"
import { StartEndDate } from "./StartEndDate.tsx"
import { StepGuests } from "../addstayflow/stepguests/StepGuests.tsx"
import { StepRooms } from "../addstayflow/steprooms/StepRooms.tsx"
import { StepConfirm } from "../addstayflow/stepconfirm/StepConfirm.tsx"
import { buildOccupantDots } from "../occupantDots.ts"
import styles from "./PlanStayFlowSheet.module.css"

// The stacked variant of the plan-stay flow. Where AddStayFlow paginates the
// four steps behind a stepper, this renders them all at once (dates → guests →
// rooms → review) so the whole flow scrolls inside one bottom sheet. The step
// components are reused as-is; passing empty step classes keeps every section
// visible instead of toggling on `isActive`.
function PlanStayFlowContent({
  propertyId,
  onComplete,
}: {
  propertyId: number
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
  const guestInputRef = useRef<HTMLInputElement>(null)

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

  const dotsByDay = useMemo(
    () => buildOccupantDots(bookings, userGroups),
    [bookings, userGroups],
  )

  const { startInputRef, endInputRef } = useSingleDateFlatpickr(
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

  return (
    <form
      className={styles.stack}
      action={() => {
        submit({ kind: "submit" })
      }}
    >
      {selectedUserId == null && (
        <Paragraph role="alert">
          {t("No user selected — pick one from the header.")}
        </Paragraph>
      )}

      <StartEndDate startInputRef={startInputRef} endInputRef={endInputRef} />

      <StepGuests
        isActive
        users={users}
        otherUsers={otherUsers}
        selectedUserId={selectedUserId}
        draft={draft}
        dispatch={dispatch}
        guestInputRef={guestInputRef}
        stepClass=""
        stepActiveClass=""
      />

      <StepRooms
        isActive
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
        stepClass=""
        stepActiveClass=""
      />

      <StepConfirm
        isActive
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
        stepClass=""
        stepActiveClass=""
      />
    </form>
  )
}

export function PlanStayFlowSheet({
  propertyId,
  open,
  onClose,
}: {
  propertyId: number
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation("planstay")
  return (
    <Dialog
      placement="bottom"
      open={open}
      onClose={onClose}
      className={styles.sheet}
    >
      <Dialog.Block>
        <Heading level={2} data-size="sm">
          {t("Plan a stay")}
        </Heading>
      </Dialog.Block>
      <Dialog.Block>
        {/* Mounted only while open so each opening starts from a fresh draft. */}
        {open && (
          <QueryBoundary>
            <PlanStayFlowContent propertyId={propertyId} onComplete={onClose} />
          </QueryBoundary>
        )}
      </Dialog.Block>
    </Dialog>
  )
}
