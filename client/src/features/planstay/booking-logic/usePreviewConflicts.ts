import { useDeferredValue, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Temporal } from "temporal-polyfill"
import { useTRPC } from "@/trpc/trpc"
import type { BookingDraft, PreviewConflicts } from "./types.ts"

type PreviewInput = {
  property_id: number
  start_date: Temporal.PlainDate
  end_date: Temporal.PlainDate
  occupants: {
    user_id: number
    room_id?: number | null
    sleeps_separately?: boolean
  }[]
  guests: {
    is_child: boolean
    room_id?: number | null
    sleeps_separately?: boolean
  }[]
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
  const childByGuestId = new Map(draft.guests.map(g => [g.user_id, g.is_child]))
  return {
    property_id: draft.property_id,
    // The draft keeps ISO strings; convert at the tRPC boundary. Guests ride
    // in occupants under negative ids — split them back out for the wire.
    start_date: Temporal.PlainDate.from(draft.start_date),
    end_date: Temporal.PlainDate.from(draft.end_date),
    occupants: draft.occupants
      .filter(o => o.user_id > 0)
      .map(o => ({
        user_id: o.user_id,
        room_id: o.room_id,
        sleeps_separately: o.sleeps_separately,
      })),
    guests: draft.occupants
      .filter(o => o.user_id < 0)
      .map(o => ({
        is_child: childByGuestId.get(o.user_id) ?? false,
        room_id: o.room_id,
        sleeps_separately: o.sleeps_separately,
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
  start_date: Temporal.PlainDate.from("2000-01-01"),
  end_date: Temporal.PlainDate.from("2000-01-01"),
  occupants: [],
  guests: [],
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
    // extractInput reads exactly these five draft fields; listing them
    // (not `draft`) keeps the memo stable across unrelated draft changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      draft.property_id,
      draft.start_date,
      draft.end_date,
      draft.occupants,
      draft.guests,
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
