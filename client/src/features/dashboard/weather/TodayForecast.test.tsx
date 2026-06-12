import { beforeAll, describe, expect, test } from "vitest"
import { render } from "@testing-library/react"
import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import { Temporal } from "temporal-polyfill"
import { TodayForecast } from "./TodayForecast"

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

describe("TodayForecast", () => {
  test("renders nothing when there are no slots", () => {
    const { container } = render(<TodayForecast slots={[]} />)
    expect(container.firstChild).toBeNull()
  })

  test("renders a slot per entry with Oslo 6h range labels and rounded temps", () => {
    const { getAllByRole, getByText } = render(
      <TodayForecast
        slots={[
          {
            // 10:00Z → 12:00 in summer Oslo (UTC+2)
            time: Temporal.Instant.from("2026-06-12T10:00:00Z"),
            temperature_c: 14.6,
            symbol_code: "clearsky_day",
          },
          {
            time: Temporal.Instant.from("2026-06-12T16:00:00Z"),
            temperature_c: 9.2,
            symbol_code: "rain",
          },
        ]}
      />,
    )
    expect(getAllByRole("listitem")).toHaveLength(2)
    expect(getByText("12-18")).toBeTruthy()
    expect(getByText("18-00")).toBeTruthy()
    expect(getByText("15°")).toBeTruthy()
    expect(getByText("9°")).toBeTruthy()
  })
})
