import { beforeAll, describe, expect, test } from "vitest"
import { render } from "@testing-library/react"
import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import WeatherSymbol from "./WeatherSymbol"

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

describe("WeatherSymbol", () => {
  test("renders null when code is null", () => {
    const { container } = render(<WeatherSymbol code={null} />)
    expect(container.firstChild).toBeNull()
  })

  test("maps a known clearsky_day code to ☀️", () => {
    const { getByRole } = render(<WeatherSymbol code="clearsky_day" />)
    expect(getByRole("img").textContent).toBe("☀️")
  })

  test("strips day/night/polartwilight suffix and maps the root", () => {
    // 'cloudy_day' is not in the map directly; root 'cloudy' -> '☁️'
    const { getByRole } = render(<WeatherSymbol code="cloudy_day" />)
    expect(getByRole("img").textContent).toBe("☁️")
  })

  test("falls back to thunder emoji for thunder substring", () => {
    const { getByRole } = render(<WeatherSymbol code="thundershowers_day" />)
    expect(getByRole("img").textContent).toBe("⛈️")
  })

  test("falls back to the partly-sunny default for unknown codes", () => {
    const { getByRole } = render(<WeatherSymbol code="zzz_unknown" />)
    expect(getByRole("img").textContent).toBe("🌤️")
  })

  test("applies the --symbol-size CSS variable from the size prop", () => {
    const { getByRole } = render(<WeatherSymbol code="rain" size={42} />)
    expect(getByRole("img").getAttribute("style")).toContain("--symbol-size: 42px")
  })
})
