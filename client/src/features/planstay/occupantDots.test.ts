import { describe, expect, test } from "vitest"
import { Temporal } from "temporal-polyfill"
import { buildOccupantDots } from "./occupantDots.ts"
import { BOOKING_MAX, BOOKING_MIN } from "./constants.ts"

const pd = (iso: string) => Temporal.PlainDate.from(iso)

// All dates kept inside the bookable window so they aren't clamped.
const groups = [
  { id: 7, is_family: true, members: [{ user_id: 1 }, { user_id: 2 }] },
  { id: 9, is_family: true, members: [{ user_id: 3 }] },
  // Non-family groups must not contribute colors.
  { id: 99, is_family: false, members: [{ user_id: 4 }] },
]

function booking(
  over: Partial<Parameters<typeof buildOccupantDots>[0][number]>,
) {
  return {
    id: 1,
    status: "confirmed",
    start_date: pd("2026-07-10"),
    end_date: pd("2026-07-10"),
    occupants: [],
    ...over,
  }
}

describe("buildOccupantDots", () => {
  test("one entry per non-queued occupant per day, keyed by family group", () => {
    const dots = buildOccupantDots(
      [
        booking({
          start_date: pd("2026-07-10"),
          end_date: pd("2026-07-11"),
          occupants: [
            { user_id: 1, queued: false },
            { user_id: 2, queued: false },
            { user_id: 3, queued: false },
          ],
        }),
      ],
      groups,
    )
    expect(dots.get("2026-07-10")).toEqual([7, 7, 9])
    // end_date is inclusive (last night).
    expect(dots.get("2026-07-11")).toEqual([7, 7, 9])
  })

  test("queued occupants and cancelled bookings are ignored", () => {
    const dots = buildOccupantDots(
      [
        booking({
          occupants: [
            { user_id: 1, queued: false },
            { user_id: 2, queued: true },
          ],
        }),
        booking({
          id: 2,
          status: "cancelled",
          occupants: [{ user_id: 3, queued: false }],
        }),
      ],
      groups,
    )
    expect(dots.get("2026-07-10")).toEqual([7])
  })

  test("occupant without a family group is 0", () => {
    const dots = buildOccupantDots(
      [booking({ occupants: [{ user_id: 4, queued: false }] })],
      groups,
    )
    expect(dots.get("2026-07-10")).toEqual([0])
  })

  test("excludeBookingId drops that booking", () => {
    const dots = buildOccupantDots(
      [
        booking({ id: 5, occupants: [{ user_id: 1, queued: false }] }),
        booking({ id: 6, occupants: [{ user_id: 3, queued: false }] }),
      ],
      groups,
      { excludeBookingId: 5 },
    )
    expect(dots.get("2026-07-10")).toEqual([9])
  })

  test("ranges are clamped to the bookable window", () => {
    const min = pd(BOOKING_MIN)
    const max = pd(BOOKING_MAX)
    const dots = buildOccupantDots(
      [
        booking({
          start_date: min.subtract({ days: 30 }),
          end_date: max.add({ days: 30 }),
          occupants: [{ user_id: 1, queued: false }],
        }),
      ],
      groups,
    )
    expect(dots.has(min.subtract({ days: 1 }).toString())).toBe(false)
    expect(dots.get(min.toString())).toEqual([7])
    expect(dots.get(max.toString())).toEqual([7])
    expect(dots.has(max.add({ days: 1 }).toString())).toBe(false)
  })
})
