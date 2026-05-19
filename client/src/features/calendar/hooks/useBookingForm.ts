import { useActionState, useReducer } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import {
  bookingDraftReducer,
  initialBookingDraft,
  setBooker,
  usePreviewConflicts,
} from "@/features/calendar/booking-logic"
import type { BookingDraft } from "@/features/calendar/booking-logic"

export type SubmitState = { error: string | null; confirming: boolean }

export type SubmitAction =
  | { kind: "submit" }
  | { kind: "confirm"; draft: BookingDraft }
  | { kind: "cancel" }

const INITIAL_SUBMIT_STATE: SubmitState = { error: null, confirming: false }

function isDraftSubmittable(d: BookingDraft): boolean {
  return (
    d.property_id != null
    && d.booker_id != null
    && d.start_date != null
    && d.end_date != null
  )
}

export function useBookingForm(
  propertyId: number,
  selectedUserId: number | null,
  onCreated?: () => void,
) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [draft, dispatch] = useReducer(bookingDraftReducer, initialBookingDraft)

  if (selectedUserId != null && draft.booker_id !== selectedUserId) {
    dispatch(setBooker(selectedUserId, propertyId))
  }

  const { data: conflicts, isFetching, hasWarnings } = usePreviewConflicts(draft)

  const createMutation = useMutation(trpc.booking.create.mutationOptions())

  const runMutation = async (d: BookingDraft): Promise<SubmitState> => {
    if (!isDraftSubmittable(d)) return INITIAL_SUBMIT_STATE
    try {
      await createMutation.mutateAsync({
        property_id: d.property_id!,
        booker_id: d.booker_id!,
        start_date: d.start_date!,
        end_date: d.end_date!,
        status: d.status,
        notes: d.notes.trim() !== "" ? d.notes : null,
        occupants: d.occupants.map(o => ({
          user_id: o.user_id,
          room_id: o.room_id,
          queued: o.queued,
        })),
      })
      dispatch({ type: "RESET" })
      void qc.invalidateQueries({ queryKey: trpc.booking.pathKey() })
      onCreated?.()
      return INITIAL_SUBMIT_STATE
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Submit failed",
        confirming: false,
      }
    }
  }

  const [submitState, submit, isPending] = useActionState<SubmitState, SubmitAction>(
    async (_prev, action) => {
      if (action.kind === "cancel") return INITIAL_SUBMIT_STATE
      if (action.kind === "submit") {
        if (hasWarnings) return { error: null, confirming: true }
        return runMutation(draft)
      }
      return runMutation(action.draft)
    },
    INITIAL_SUBMIT_STATE,
  )

  const canSubmit =
    selectedUserId != null
    && draft.start_date != null
    && draft.end_date != null
    && !isPending

  return {
    draft,
    dispatch,
    conflicts,
    isFetching,
    hasWarnings,
    submitState,
    submit,
    isPending,
    canSubmit,
  }
}
