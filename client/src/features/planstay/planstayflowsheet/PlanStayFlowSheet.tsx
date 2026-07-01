import { useMemo, useRef, useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Button,
  Dialog,
  Heading,
  Paragraph,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { useSelectedUserId } from "@/selection/useSelection"
import type { BookingDraftRecord } from "@/features/planstay/booking-logic"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import { useSingleDateFlatpickr } from "../hooks/useSingleDateFlatpickr.ts"
import { useBookingForm } from "../hooks/useBookingForm.ts"
import { useOccupancyData } from "../hooks/useOccupancyData.ts"
import { useOverlappingPriorityWeeks } from "../hooks/useOverlappingPriorityWeeks.ts"
import { StartEndDate } from "./StartEndDate.tsx"
import { StayAvailabilityPanel } from "./StayAvailabilityPanel.tsx"
import { StepQuestion } from "./StepQuestion.tsx"
import { StepGuests } from "../addstayflow/stepguests/StepGuests.tsx"
import { StepRooms } from "../addstayflow/steprooms/StepRooms.tsx"
import { StepConfirm } from "../addstayflow/stepconfirm/StepConfirm.tsx"
import { buildOccupantDots } from "../occupantDots.ts"
import styles from "./PlanStayFlowSheet.module.css"

type EditTarget = { bookingId: number; initialRecord: BookingDraftRecord }

// The stacked variant of the plan-stay flow. Where AddStayFlow paginates the
// four steps behind a stepper, this renders them all at once (dates → guests →
// rooms → review) so the whole flow scrolls inside one bottom sheet. The step
// components are reused as-is; passing empty step classes keeps every section
// visible instead of toggling on `isActive`. When `edit` is supplied the same
// layout drives an existing booking instead of a fresh draft.
function PlanStayFlowContent({
  propertyId,
  edit,
  onComplete,
}: {
  propertyId: number
  edit?: EditTarget
  onComplete: () => void
}) {
  const { t } = useTranslation("planstay")
  const trpc = useTRPC()
  const selectedUserId = useSelectedUserId()
  // In edit mode the booking's own booker drives the flow, not the header
  // selection; in create mode we follow whoever is selected in the header.
  const effectiveUserId = edit ? edit.initialRecord.booker_id : selectedUserId

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

  const propertyStructures = structures.filter(
    b => b.property_id === propertyId,
  )
  const propertyStructureIds = new Set(propertyStructures.map(b => b.id))
  const propertyRooms = rooms.filter(r =>
    propertyStructureIds.has(r.structure_id),
  )
  const otherUsers = users.filter(u => u.id !== effectiveUserId)

  // Default the Rooms panel open on the first room of the first building that
  // has any rooms — matching how StepRooms renders (it skips empty buildings).
  const defaultExpandedRoomId =
    propertyStructures
      .map(s => propertyRooms.find(r => r.structure_id === s.id))
      .find(r => r != null)?.id ?? null

  const [expandedRoomId, setExpandedRoomId] = useState<number | null>(
    () => defaultExpandedRoomId,
  )
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
  } = useBookingForm(
    propertyId,
    effectiveUserId,
    edit
      ? {
          kind: "edit",
          bookingId: edit.bookingId,
          initialRecord: edit.initialRecord,
        }
      : { kind: "create" },
    () => {
      onComplete()
    },
  )

  // Calendar dots show who else is around; exclude the stay being edited so
  // its own (possibly changing) dates don't double-count.
  const dotsByDay = useMemo(
    () =>
      buildOccupantDots(bookings, userGroups, {
        excludeBookingId: edit?.bookingId,
      }),
    [bookings, userGroups, edit?.bookingId],
  )

  const { startInputRef, endInputRef } = useSingleDateFlatpickr(
    draft,
    dispatch,
    dotsByDay,
  )

  const occupancy = useOccupancyData({
    bookings: edit ? bookings.filter(b => b.id !== edit.bookingId) : bookings,
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
    <form
      className={styles.stack}
      action={() => {
        submit({ kind: "submit" })
      }}
    >
      {effectiveUserId == null && (
        <Paragraph role="alert">
          {t("No user selected — pick one from the header.")}
        </Paragraph>
      )}

      {draft.status === "cancelled" && (
        <Paragraph role="alert">{t("This stay is cancelled.")}</Paragraph>
      )}

      <StartEndDate startInputRef={startInputRef} endInputRef={endInputRef} />

      <StayAvailabilityPanel
        totalBeds={occupancy.totalBeds}
        occupiedBeds={occupancy.occupiedBeds}
        overlappingBookings={occupancy.overlappingBookings}
        overlappingPriorityWeeks={overlappingPriorityWeeks}
        hasStartDate={draft.start_date != null}
      />

      <StepQuestion
        question={t("Who's coming?")}
        description={t("Add the people joining you.")}
      >
        <StepGuests
          isActive
          users={users}
          otherUsers={otherUsers}
          selectedUserId={effectiveUserId}
          draft={draft}
          dispatch={dispatch}
          guestInputRef={guestInputRef}
          stepClass=""
          stepActiveClass=""
        />
      </StepQuestion>

      <StepQuestion
        question={t("Where will everyone sleep?")}
        description={t("Assign your group to rooms and beds.")}
      >
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
          selectedUserId={effectiveUserId}
          expandedRoomId={expandedRoomId}
          setExpandedRoomId={setExpandedRoomId}
          conflicts={conflicts}
          stepClass=""
          stepActiveClass=""
        />
      </StepQuestion>

      <StepQuestion
        question={t("Ready to confirm?")}
        description={t("Check the summary and confirm your stay.")}
      >
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
          submitLabel={edit ? t("Save changes") : undefined}
          submitWarningsLabel={
            edit ? t("Save changes (warnings present)") : undefined
          }
          submitPendingLabel={edit ? t("Saving…") : undefined}
          extraActions={
            edit && draft.status !== "cancelled" ? (
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
            ) : undefined
          }
        />
      </StepQuestion>
    </form>
  )
}

export function PlanStayFlowSheet({
  propertyId,
  open,
  onClose,
  edit,
}: {
  propertyId: number
  open: boolean
  onClose: () => void
  edit?: EditTarget
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
          {edit ? t("Edit stay") : t("Plan a stay")}
        </Heading>
      </Dialog.Block>
      <Dialog.Block>
        {/* Mounted only while open so each opening starts from a fresh draft. */}
        {open && (
          <QueryBoundary>
            <PlanStayFlowContent
              propertyId={propertyId}
              edit={edit}
              onComplete={onClose}
            />
          </QueryBoundary>
        )}
      </Dialog.Block>
    </Dialog>
  )
}
