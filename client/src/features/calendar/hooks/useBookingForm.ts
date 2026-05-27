import { useActionState, useReducer } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import {
  bookingDraftReducer,
  initialBookingDraft,
  setBooker,
  usePreviewConflicts,
} from "@/features/calendar/booking-logic"
import type {
  BookingDraft,
  BookingDraftRecord,
} from "@/features/calendar/booking-logic"

export type SubmitState = { error: string | null; confirming: boolean }

export type SubmitAction =
  | { kind: "submit" }
  | { kind: "confirm"; draft: BookingDraft }
  | { kind: "cancel" }
  | { kind: "cancel-stay" }

const INITIAL_SUBMIT_STATE: SubmitState = { error: null, confirming: false }

export type BookingFormMode =
  | { kind: "create" }
  | { kind: "edit"; bookingId: number; initialRecord: BookingDraftRecord }

type SubmittableDraft = BookingDraft & {
  property_id: NonNullable<BookingDraft["property_id"]>
  booker_id: NonNullable<BookingDraft["booker_id"]>
  start_date: NonNullable<BookingDraft["start_date"]>
  end_date: NonNullable<BookingDraft["end_date"]>
}

function isDraftSubmittable(d: BookingDraft): d is SubmittableDraft {
  return (
    d.property_id != null &&
    d.booker_id != null &&
    d.start_date != null &&
    d.end_date != null
  )
}

function recordToDraft(r: BookingDraftRecord): BookingDraft {
  return {
    property_id: r.property_id,
    booker_id: r.booker_id,
    start_date: r.start_date,
    end_date: r.end_date,
    status: r.status,
    notes: r.notes ?? "",
    occupants: r.occupants.map(o => ({
      user_id: o.user_id,
      room_id: o.room_id,
      queued: o.queued,
    })),
  }
}

export function useBookingForm(
  propertyId: number,
  selectedUserId: number | null,
  mode: BookingFormMode,
  onSuccess?: () => void,
) {
  const { t } = useTranslation("calendar")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [draft, dispatch] = useReducer(
    bookingDraftReducer,
    mode.kind === "edit"
      ? recordToDraft(mode.initialRecord)
      : initialBookingDraft,
  )

  if (
    mode.kind === "create" &&
    selectedUserId != null &&
    draft.booker_id !== selectedUserId
  ) {
    dispatch(setBooker(selectedUserId, propertyId))
  }

  const excludeBookingId = mode.kind === "edit" ? mode.bookingId : undefined

  const {
    data: conflicts,
    isFetching,
    hasWarnings,
  } = usePreviewConflicts(draft, excludeBookingId)

  const createMutation = useMutation(trpc.booking.create.mutationOptions())
  const updateMutation = useMutation(trpc.booking.update.mutationOptions())

  const runMutation = async (d: BookingDraft): Promise<SubmitState> => {
    if (!isDraftSubmittable(d)) return INITIAL_SUBMIT_STATE
    try {
      const payload = {
        property_id: d.property_id,
        start_date: d.start_date,
        end_date: d.end_date,
        status: d.status,
        notes: d.notes.trim() !== "" ? d.notes : null,
        occupants: d.occupants.map(o => ({
          user_id: o.user_id,
          room_id: o.room_id,
          queued: o.queued,
        })),
      }
      if (mode.kind === "edit") {
        await updateMutation.mutateAsync({ id: mode.bookingId, ...payload })
      } else {
        await createMutation.mutateAsync(payload)
        dispatch({ type: "RESET" })
      }
      void qc.invalidateQueries({ queryKey: trpc.booking.pathKey() })
      onSuccess?.()
      return INITIAL_SUBMIT_STATE
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : t("Submit failed"),
        confirming: false,
      }
    }
  }

  const [submitState, submit, isPending] = useActionState<
    SubmitState,
    SubmitAction
  >(async (_prev, action) => {
    if (action.kind === "cancel") return INITIAL_SUBMIT_STATE
    if (action.kind === "cancel-stay") {
      if (mode.kind !== "edit") return INITIAL_SUBMIT_STATE
      return runMutation({ ...draft, status: "cancelled" })
    }
    if (action.kind === "submit") {
      if (hasWarnings) return { error: null, confirming: true }
      return runMutation(draft)
    }
    return runMutation(action.draft)
  }, INITIAL_SUBMIT_STATE)

  const canSubmit =
    selectedUserId != null &&
    draft.start_date != null &&
    draft.end_date != null &&
    !isPending

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
    mode,
  }
}
