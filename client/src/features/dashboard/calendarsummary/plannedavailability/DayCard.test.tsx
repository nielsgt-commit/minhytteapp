import { beforeAll, describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import DayCard from "./DayCard"

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

const baseProps = {
  date: new Date(2026, 6, 15), // 15 July 2026
  weekdayLabel: "WED" as const,
  iso: "2026-07-15",
  isSelected: false,
  isToday: false,
  hasBirthday: false,
  count: 0,
  names: [] as string[],
  onToggle: () => {},
}

describe("DayCard", () => {
  test("shows 'No guests' when count is 0 and is not clickable", () => {
    render(<DayCard {...baseProps} />)
    expect(screen.getByText("No guests")).toBeInTheDocument()
    expect(screen.queryByRole("button")).toBeNull()
  })

  test("shows guest count when > 0 and is clickable", () => {
    render(<DayCard {...baseProps} count={3} />)
    expect(screen.getByRole("button")).toBeInTheDocument()
    expect(screen.getByText(/3 guest/)).toBeInTheDocument()
  })

  test("fires onToggle when clicked", async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<DayCard {...baseProps} count={2} onToggle={onToggle} />)
    await user.click(screen.getByRole("button"))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  test("fires onToggle on Enter key", async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<DayCard {...baseProps} count={2} onToggle={onToggle} />)
    const btn = screen.getByRole("button")
    btn.focus()
    await user.keyboard("{Enter}")
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  test("shows 'Today' suffix when isToday is true", () => {
    render(<DayCard {...baseProps} isToday count={1} />)
    expect(screen.getByText(/Today/)).toBeInTheDocument()
  })

  test("renders the GuestListView only when selected", () => {
    const { rerender } = render(
      <DayCard {...baseProps} count={1} names={["Alice"]} isSelected={false} />,
    )
    expect(screen.queryByText("Alice")).toBeNull()
    rerender(
      <DayCard {...baseProps} count={1} names={["Alice"]} isSelected={true} />,
    )
    expect(screen.getByText("Alice")).toBeInTheDocument()
  })

  test("renders the forecast temperatures when forecast provided", () => {
    render(
      <DayCard
        {...baseProps}
        count={0}
        forecast={{ min_c: 12.4, max_c: 19.6, symbol_code: "rain" }}
      />,
    )
    expect(screen.getByText("12° / 20°")).toBeInTheDocument()
  })
})
