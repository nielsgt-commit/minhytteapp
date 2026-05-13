import { useReducer, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import {
  bookingDraftReducer,
  initialBookingDraft,
  setBooker,
  usePreviewConflicts,
} from "@/features/calendar/booking-logic"
import type { BookingDraft } from "@/features/calendar/booking-logic"

export function useBookingForm(propertyId: number, selectedUserId: number | null) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [draft, dispatch] = useReducer(bookingDraftReducer, initialBookingDraft)
  const [confirmStep, setConfirmStep] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (selectedUserId != null && draft.booker_id !== selectedUserId) {
    dispatch(setBooker(selectedUserId, propertyId))
  }

  const { data: conflicts, isFetching, hasWarnings } = usePreviewConflicts(draft)

  const createMutation = useMutation(
    trpc.booking.create.mutationOptions({
      onSuccess: () => {
        dispatch({ type: "RESET" })
        setConfirmStep(false)
        setSubmitError(null)
        void qc.invalidateQueries({ queryKey: trpc.booking.pathKey() })
      },
      onError: err => {
        setSubmitError(err.message)
        setConfirmStep(false)
      },
    }),
  )

  const doMutate = (d: BookingDraft) => {
    if (
      d.property_id == null
      || d.booker_id == null
      || d.start_date == null
      || d.end_date == null
    ) return
    createMutation.mutate({
      property_id: d.property_id,
      booker_id: d.booker_id,
      start_date: d.start_date,
      end_date: d.end_date,
      status: d.status,
      notes: d.notes.trim() !== "" ? d.notes : null,
      occupants: d.occupants.map(o => ({
        user_id: o.user_id,
        room_id: o.room_id,
        queued: o.queued,
      })),
    })
  }

  const handleSubmit = () => {
    if (hasWarnings && !confirmStep) {
      setConfirmStep(true)
      return
    }
    doMutate(draft)
  }

  const canSubmit =
    selectedUserId != null
    && draft.start_date != null
    && draft.end_date != null
    && !createMutation.isPending

  return {
    draft,
    dispatch,
    confirmStep,
    setConfirmStep,
    submitError,
    conflicts,
    isFetching,
    hasWarnings,
    doMutate,
    handleSubmit,
    canSubmit,
    isPending: createMutation.isPending,
  }
}
