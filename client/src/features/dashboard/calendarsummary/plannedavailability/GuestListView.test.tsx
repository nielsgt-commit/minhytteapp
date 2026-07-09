import { beforeAll, describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import { GuestListView } from "./GuestListView"

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

const guest = (name: string, queued = false, pending = false) => ({
  name,
  queued,
  pending,
})

describe("GuestListView", () => {
  test("renders each name as a tag", () => {
    render(
      <GuestListView guests={[guest("Alice"), guest("Bob"), guest("Cleo")]} />,
    )
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()
    expect(screen.getByText("Cleo")).toBeInTheDocument()
  })

  test("marks queued guests with a suffix and neutral color", () => {
    render(<GuestListView guests={[guest("Alice"), guest("Maja", true)]} />)
    const queuedTag = screen.getByText("Maja (queued)")
    expect(queuedTag).toHaveAttribute("data-color", "neutral")
    expect(screen.getByText("Alice")).toHaveAttribute("data-color", "info")
  })

  test("marks guests of pending bookings with a question mark", () => {
    render(<GuestListView guests={[guest("Alice"), guest("Per", false, true)]} />)
    expect(screen.getByText("Per?")).toBeInTheDocument()
    expect(screen.getByText("Alice")).toBeInTheDocument()
  })

  test("renders nothing when guests is empty", () => {
    const { container } = render(<GuestListView guests={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
