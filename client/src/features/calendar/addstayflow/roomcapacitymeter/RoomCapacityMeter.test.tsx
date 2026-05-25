import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import i18n from "@/i18n"

vi.mock("@navikt/aksel-icons", () => ({
  BedIcon: (props: object) => <svg data-variant="empty" {...props} />,
  BedFillIcon: (props: object) => <svg data-variant="filled" {...props} />,
}))

import { RoomCapacityMeter } from "./RoomCapacityMeter.tsx"
import type { RoomShape } from "../../types.ts"

await i18n.changeLanguage("en")

const ROOM: RoomShape = {
  id: 10,
  name: "Loft",
  beds_sm: 2,
  beds_lg: 0,
  beds_double: 0,
  beds_kid: 0,
  mattresses: 0,
  travel_cot: 0,
  structure_id: 1,
}

const USERS = [
  { id: 1, name: "Alice", is_child: null },
  { id: 2, name: "Bob", is_child: null },
  { id: 3, name: "Kid", is_child: true },
]

function defaultProps() {
  return {
    room: ROOM,
    structureName: "Main cabin",
    occupantsInRoom: [],
    existingOccupantsInRoom: [],
    users: USERS,
    adultInKidOnlyUserIds: [],
    unassignedOccupants: [],
    onAssign: vi.fn(),
    onRemove: vi.fn(),
    isBooker: (_uid: number) => false,
    isExpanded: false,
    onToggle: vi.fn(),
  }
}

describe("RoomCapacityMeter", () => {
  test("collapsed view shows room name, structure name and placed/total tag", () => {
    render(
      <RoomCapacityMeter
        {...defaultProps()}
        occupantsInRoom={[{ user_id: 1, queued: false }]}
      />,
    )
    expect(screen.getByText("Loft")).toBeInTheDocument()
    expect(screen.getByText("Main cabin")).toBeInTheDocument()
    expect(screen.getByText("1/2 beds")).toBeInTheDocument()
  })

  test("clicking the header toggle invokes onToggle", async () => {
    const onToggle = vi.fn()
    render(<RoomCapacityMeter {...defaultProps()} onToggle={onToggle} />)
    await userEvent.click(screen.getByRole("button", { name: /loft/i }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  test("expanded view lists already-booked occupants", () => {
    render(
      <RoomCapacityMeter
        {...defaultProps()}
        isExpanded
        existingOccupantsInRoom={[
          { user_id: 5, user_name: "Carol", queued: false },
        ]}
      />,
    )
    expect(screen.getByText("Already booked")).toBeInTheDocument()
    expect(screen.getByText("Carol")).toBeInTheDocument()
  })

  test("expanded view shows over-capacity warning when placed exceeds total", () => {
    render(
      <RoomCapacityMeter
        {...defaultProps()}
        isExpanded
        occupantsInRoom={[
          { user_id: 1, queued: false },
          { user_id: 2, queued: false },
          { user_id: 3, queued: false },
        ]}
      />,
    )
    expect(screen.getByText(/Over capacity by 1/)).toBeInTheDocument()
  })

  test("remove button is hidden for the booker", () => {
    render(
      <RoomCapacityMeter
        {...defaultProps()}
        isExpanded
        occupantsInRoom={[{ user_id: 1, queued: false }]}
        isBooker={uid => uid === 1}
      />,
    )
    expect(screen.queryByRole("button", { name: /remove/i })).toBeNull()
  })

  test("clicking remove on a non-booker calls onRemove with their id", async () => {
    const onRemove = vi.fn()
    render(
      <RoomCapacityMeter
        {...defaultProps()}
        isExpanded
        occupantsInRoom={[{ user_id: 2, queued: false }]}
        onRemove={onRemove}
      />,
    )
    await userEvent.click(screen.getByRole("button", { name: /remove bob/i }))
    expect(onRemove).toHaveBeenCalledWith(2)
  })
})
