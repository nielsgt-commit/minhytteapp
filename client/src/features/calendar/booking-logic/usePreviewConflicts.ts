import { useDeferredValue, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import type { BookingDraft, PreviewConflicts } from "./types.ts"

type PreviewInput = {
  property_id: number
  start_date: string
  end_date: string
  occupants: { user_id: number; room_id?: number | null }[]
  exclude_booking_id?: number
}

function extractInput(
  draft: BookingDraft,
  excludeBookingId?: number,
): PreviewInput | null {
  if (
    draft.property_id == null ||
    draft.start_date == null ||
    draft.end_date == null ||
    draft.occupants.length === 0
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
    ...(excludeBookingId != null
      ? { exclude_booking_id: excludeBookingId }
      : {}),
  }
}

function hasAnyWarning(data: PreviewConflicts | undefined): boolean {
  if (!data) return false
  if (data.property.overCapacityBy > 0) return true
  if (data.perRoom.some(r => r.overCapacityBy > 0)) return true
  if (data.perRoom.some(r => r.adultInKidOnlyUserIds.length > 0)) return true
  return false
}

const FALLBACK_INPUT: PreviewInput = {
  property_id: 0,
  start_date: "2000-01-01",
  end_date: "2000-01-01",
  occupants: [],
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

  const input = useMemo(
    () => extractInput(draft, excludeBookingId),
    [
      draft.property_id,
      draft.start_date,
      draft.end_date,
      draft.occupants,
      excludeBookingId,
    ],
  )
  const deferredInput = useDeferredValue(input)

  const query = useQuery({
    ...trpc.booking.previewConflicts.queryOptions(
      deferredInput ?? FALLBACK_INPUT,
    ),
    enabled: deferredInput != null,
    placeholderData: prev => prev,
  })

  return {
    data: query.data,
    isFetching: query.isFetching,
    hasWarnings: hasAnyWarning(query.data),
  }
}
