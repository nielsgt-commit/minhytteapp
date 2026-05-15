import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import type { BookingDraft, PreviewConflicts } from "./types.ts"

// Debounce delay in ms before firing the preview query
const DEBOUNCE_MS = 400

/**
 * Wraps trpc.booking.previewConflicts.
 *
 * Returns:
 *   data        — the PreviewConflicts result (or undefined while loading)
 *   isFetching  — true while a query is in-flight
 *   hasWarnings — true if any conflict/capacity issue exists
 *
 * The query is only enabled when the draft has a property_id, a valid
 * date range, and at least one occupant.
 *
 * NOTE: TanStack Query v5 does not natively debounce. We debounce by
 * delaying state updates so rapid changes don't fire a request per keystroke.
 */

type PreviewInput = {
  property_id: number
  start_date: string
  end_date: string
  occupants: Array<{ user_id: number; room_id?: number | null }>
  exclude_booking_id?: number
}

function extractInput(
  draft: BookingDraft,
  excludeBookingId?: number,
): PreviewInput | null {
  if (
    draft.property_id == null
    || draft.start_date == null
    || draft.end_date == null
    || draft.occupants.length === 0
  ) {
    return null
  }
  return {
    property_id: draft.property_id,
    start_date: draft.start_date,
    end_date: draft.end_date,
    occupants: draft.occupants.map(o => ({
      user_id: o.user_id,
      room_id: o.room_id,
    })),
    ...(excludeBookingId != null ? { exclude_booking_id: excludeBookingId } : {}),
  }
}

function hasAnyWarning(data: PreviewConflicts | undefined): boolean {
  if (!data) return false
  if (data.property.overCapacityBy > 0) return true
  if (data.perRoom.some(r => r.overCapacityBy > 0)) return true
  if (data.perRoom.some(r => r.adultInKidOnlyUserIds.length > 0)) return true
  return false
}

export function usePreviewConflicts(
  draft: BookingDraft,
  excludeBookingId?: number,
): {
  data: PreviewConflicts | undefined
  isFetching: boolean
  hasWarnings: boolean
} {
  const trpc = useTRPC()
  const [debouncedInput, setDebouncedInput] = useState<PreviewInput | null>(
    () => extractInput(draft, excludeBookingId),
  )
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Serialise occupants for stable dep tracking
  const occupantsKey = JSON.stringify(draft.occupants)

  useEffect(() => {
    const next = extractInput(draft, excludeBookingId)

    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      setDebouncedInput(next)
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.property_id, draft.start_date, draft.end_date, occupantsKey, excludeBookingId])

  // When input becomes null (draft is incomplete), clear immediately
  useEffect(() => {
    if (debouncedInput != null) return
    if (extractInput(draft, excludeBookingId) == null) {
      setDebouncedInput(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.property_id, draft.start_date, draft.end_date, occupantsKey])

  const fallbackInput: PreviewInput = {
    property_id: 0,
    start_date: "2000-01-01",
    end_date: "2000-01-01",
    occupants: [],
  }

  const query = useQuery({
    ...trpc.booking.previewConflicts.queryOptions(
      debouncedInput ?? fallbackInput,
    ),
    enabled: debouncedInput != null,
    placeholderData: prev => prev,
  })

  return {
    data: query.data,
    isFetching: query.isFetching,
    hasWarnings: hasAnyWarning(query.data),
  }
}
