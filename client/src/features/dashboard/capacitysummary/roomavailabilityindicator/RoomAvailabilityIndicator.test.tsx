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
      resources: { en: { dashboard: {} } },
      keySeparator: false,
      nsSeparator: ":",
      interpolation: { escapeValue: false },
    })
  }
})

const emptyBeds = {
  beds_sm: 0,
  beds_lg: 0,
  beds_double: 0,
  beds_kid: 0,
  mattresses: 0,
  travel_cot: 0,
}

describe("RoomAvailabilityIndicator", () => {
  test("groups rooms by structure and shows the structure name", () => {
    render(
      <RoomAvailabilityIndicator
        rooms={[
          {
            ...emptyBeds,
            beds_sm: 2,
            structure_id: 1,
            structure_name: "Main cabin",
          },
          {
            ...emptyBeds,
            beds_lg: 1,
            structure_id: 1,
            structure_name: "Main cabin",
          },
          {
            ...emptyBeds,
            beds_sm: 1,
            structure_id: 2,
            structure_name: "Annex",
          },
        ]}
      />,
    )
    expect(screen.getAllByText("Main cabin")).toHaveLength(1)
    expect(screen.getByText("Annex")).toBeInTheDocument()
  })

  test("falls back to 'Structure #{id}' when name missing", () => {
    render(
      <RoomAvailabilityIndicator
        rooms={[{ ...emptyBeds, beds_sm: 3, structure_id: 99 }]}
      />,
    )
    expect(screen.getByText("Structure #99")).toBeInTheDocument()
  })

  test("uses 'success' color when many beds available", () => {
    const { container } = render(
      <RoomAvailabilityIndicator
        rooms={[
          { ...emptyBeds, beds_sm: 5, structure_id: 1, structure_name: "Big" },
        ]}
      />,
    )
    expect(container.querySelector('[data-color="success"]')).not.toBeNull()
  })

  test("uses 'danger' color when total beds <= 1", () => {
    const { container } = render(
      <RoomAvailabilityIndicator
        rooms={[
          { ...emptyBeds, beds_sm: 1, structure_id: 1, structure_name: "Tiny" },
        ]}
      />,
    )
    expect(container.querySelector('[data-color="danger"]')).not.toBeNull()
  })

  test("counts double beds twice when summing capacity", () => {
    render(
      <RoomAvailabilityIndicator
        rooms={[
          {
            ...emptyBeds,
            beds_double: 3,
            structure_id: 7,
            structure_name: "Double-house",
          },
        ]}
      />,
    )
    // 3 double beds = 6 capacity, well above 1 → 'success'
    const tag = screen.getByText("Double-house")
    expect(tag.closest("[data-color]")?.getAttribute("data-color")).toBe(
      "success",
    )
  })
})
