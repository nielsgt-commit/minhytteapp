import { beforeAll, describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import GuestListView from "./GuestListView"

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

describe("GuestListView", () => {
  test("renders each name as a tag", () => {
    render(<GuestListView names={["Alice", "Bob", "Cleo"]} />)
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()
    expect(screen.getByText("Cleo")).toBeInTheDocument()
  })

  test("renders 'No guests' fallback when names is empty", () => {
    render(<GuestListView names={[]} />)
    expect(screen.getByText("No guests")).toBeInTheDocument()
  })
})
