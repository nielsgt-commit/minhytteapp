import { useActionState, useReducer } from "react"
// eslint-disable-next-line no-restricted-imports -- one shared pathKey-wide invalidation runs after whichever of create/update fired
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Temporal } from "temporal-polyfill"
import { useTRPC } from "@/trpc/trpc"
import {
  bookingDraftReducer,
  initialBookingDraft,
  setBooker,
  usePreviewConflicts,
} from "@/features/planstay/booking-logic"
import type {
  BookingDraft,
  BookingDraftRecord,
} from "@/features/planstay/booking-logic"

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
  const guests = r.guests ?? []
  return {
    property_id: r.property_id,
    booker_id: r.booker_id,
    start_date: r.start_date,
    end_date: r.end_date,
    status: r.status,
    notes: r.notes ?? "",
    occupants: [
      ...r.occupants.map(o => ({
        user_id: o.user_id,
        room_id: o.room_id,
        queued: o.queued,
        sleeps_separately: o.sleeps_separately ?? false,
      })),
      ...guests.map((g, i) => ({
        user_id: -(i + 1),
        room_id: g.room_id,
        queued: false,
        sleeps_separately: g.sleeps_separately ?? false,
      })),
    ],
    guests: guests.map((g, i) => ({
      user_id: -(i + 1),
      name: g.name,
      is_child: g.is_child,
    })),
  }
}

// Split the draft's occupant list back into real occupants and named guests
// (negative synthetic ids) for the create/update payload.
export function splitDraftOccupants(d: BookingDraft) {
  const guestByKey = new Map(d.guests.map(g => [g.user_id, g]))
  const occupants = []
  const guests = []
  for (const o of d.occupants) {
    if (o.user_id > 0) {
      occupants.push({
        user_id: o.user_id,
        room_id: o.room_id,
        queued: o.queued,
        sleeps_separately: o.sleeps_separately,
      })
      continue
    }
    const g = guestByKey.get(o.user_id)
    if (!g) continue
    guests.push({
      name: g.name,
      is_child: g.is_child,
      room_id: o.room_id,
      sleeps_separately: o.sleeps_separately,
    })
  }
  return { occupants, guests }
}

export function useBookingForm(
  propertyId: number,
  selectedUserId: number | null,
  mode: BookingFormMode,
  onSuccess?: () => void,
) {
  const { t } = useTranslation("planstay")
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
      const { occupants, guests } = splitDraftOccupants(d)
      const payload = {
        property_id: d.property_id,
        // The draft keeps ISO strings; convert at the tRPC boundary.
        start_date: Temporal.PlainDate.from(d.start_date),
        end_date: Temporal.PlainDate.from(d.end_date),
        status: d.status,
        notes: d.notes.trim() !== "" ? d.notes : null,
        occupants,
        guests,
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
    // The server requires at least one real (user) occupant per booking.
    draft.occupants.some(o => o.user_id > 0) &&
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
