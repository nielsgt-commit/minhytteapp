import { describe, expect, it } from "vitest"
import { Temporal } from "../../shared/temporal.ts"
import { wireMap } from "./wire.ts"

describe("wireMap", () => {
  it("converts each kind and passes other keys through untouched", () => {
    const toWire = wireMap({
      created_at: "instant",
      closed_at: "instantOrNull",
      date: "plainDate",
      birthday: "plainDateOrNull",
    })
    const wired = toWire({
      id: 7,
      name: "x",
      created_at: new Date("2026-07-10T10:00:00Z"),
      closed_at: null,
      date: "2026-07-10",
      birthday: null,
    })
    expect(wired.id).toBe(7)
    expect(wired.name).toBe("x")
    expect(wired.created_at).toBeInstanceOf(Temporal.Instant)
    expect(wired.created_at.toString()).toBe("2026-07-10T10:00:00Z")
    expect(wired.closed_at).toBeNull()
    expect(wired.date).toBeInstanceOf(Temporal.PlainDate)
    expect(wired.date.toString()).toBe("2026-07-10")
    expect(wired.birthday).toBeNull()
  })

  it("converts non-null values of nullable kinds", () => {
    const toWire = wireMap({
      paid_at: "instantOrNull",
      receipt_date: "plainDateOrNull",
    })
    const wired = toWire({
      paid_at: new Date("2026-01-01T00:00:00Z"),
      receipt_date: "2026-01-02",
    })
    expect(wired.paid_at).toBeInstanceOf(Temporal.Instant)
    expect(wired.receipt_date?.toString()).toBe("2026-01-02")
  })

  it("does not mutate the input row", () => {
    const toWire = wireMap({ created_at: "instant" })
    const row = { created_at: new Date("2026-01-01T00:00:00Z") }
    toWire(row)
    expect(row.created_at).toBeInstanceOf(Date)
  })

  it("rejects invalid rows at compile time", () => {
    // Type-only assertions: the closures are never invoked; tsc verifying
    // the expect-error directives inside them is the actual test.
    const typeOnly = [
      () => {
        const toWire = wireMap({ created_at: "instant" })
        // @ts-expect-error updated_at is a Date column missing from the spec
        toWire({ created_at: new Date(), updated_at: new Date() })
        // @ts-expect-error cancelled_at (Date | null) is missing from the spec
        toWire({ created_at: new Date(), cancelled_at: null as Date | null })
      },
      () => {
        const toWire = wireMap({
          created_at: "instant",
          paid_at: "instantOrNull",
        })
        // @ts-expect-error paid_at is required by the spec
        toWire({ created_at: new Date() })
        // @ts-expect-error a nullable column cannot satisfy the instant kind
        toWire({ created_at: null as Date | null, paid_at: null })
      },
    ]
    expect(typeOnly).toHaveLength(2)
  })
})
