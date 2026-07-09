import { beforeAll, describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import { RoomAvailabilityIndicator } from "./RoomAvailabilityIndicator"

beforeAll(async () => {
  if (!i18next.isInitialized) {
    await i18next.use(initReactI18next).init({
      lng: "en",
      fallbackLng: "en",
      ns: ["dashboard"],
      defaultNS: "dashboard",
      // Plural keys need real entries; everything else falls back to the key.
      resources: {
        en: {
          dashboard: {
            "{{count}} guest without a room_one":
              "{{count}} guest without a room",
            "{{count}} guest without a room_other":
              "{{count}} guests without a room",
          },
        },
      },
      keySeparator: false,
      nsSeparator: ":",
      interpolation: { escapeValue: false },
    })
  }
})

const baseRoom = {
  room_id: 1,
  name: "North room",
  structure_id: 1,
  structure_name: "Main cabin" as string | null,
  capacity: 4,
  occupied: 0,
  available: 4,
}

function room(overrides: Partial<typeof baseRoom> = {}) {
  return { ...baseRoom, ...overrides }
}

describe("RoomAvailabilityIndicator", () => {
  test("shows each room name with its available/capacity count", () => {
    render(
      <RoomAvailabilityIndicator
        rooms={[
          room({ room_id: 1, name: "North room", capacity: 4, available: 3 }),
          room({ room_id: 2, name: "South room", capacity: 2, available: 2 }),
        ]}
        unassignedGuests={0}
      />,
    )
    expect(screen.getByText("North room 3/4")).toBeInTheDocument()
    expect(screen.getByText("South room 2/2")).toBeInTheDocument()
  })

  test("shows the total available bed count", () => {
    render(
      <RoomAvailabilityIndicator
        rooms={[
          room({ room_id: 1, capacity: 4, available: 3 }),
          room({ room_id: 2, name: "South room", capacity: 2, available: 0 }),
        ]}
        unassignedGuests={0}
      />,
    )
    expect(screen.getByText("3 of 6 beds available")).toBeInTheDocument()
  })

  test("shows structure names only when rooms span multiple structures", () => {
    const { rerender } = render(
      <RoomAvailabilityIndicator
        rooms={[
          room({ room_id: 1, structure_id: 1, structure_name: "Main cabin" }),
          room({
            room_id: 2,
            name: "Annex room",
            structure_id: 2,
            structure_name: "Annex",
          }),
        ]}
        unassignedGuests={0}
      />,
    )
    expect(screen.getByText("Main cabin")).toBeInTheDocument()
    expect(screen.getByText("Annex")).toBeInTheDocument()

    rerender(
      <RoomAvailabilityIndicator
        rooms={[
          room({ room_id: 1, structure_id: 1, structure_name: "Main cabin" }),
        ]}
        unassignedGuests={0}
      />,
    )
    expect(screen.queryByText("Main cabin")).not.toBeInTheDocument()
  })

  test("falls back to 'Structure #{id}' when name missing", () => {
    render(
      <RoomAvailabilityIndicator
        rooms={[
          room({ room_id: 1, structure_id: 99, structure_name: null }),
          room({
            room_id: 2,
            structure_id: 1,
            structure_name: "Main cabin",
          }),
        ]}
        unassignedGuests={0}
      />,
    )
    expect(screen.getByText("Structure #99")).toBeInTheDocument()
  })

  test("mentions guests without a room", () => {
    render(
      <RoomAvailabilityIndicator rooms={[room({})]} unassignedGuests={2} />,
    )
    expect(screen.getByText("2 guests without a room")).toBeInTheDocument()
  })
})
