import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { MetadataSection, type Recurrence } from "./MetadataSection.tsx"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

function setup(overrides?: {
  inspectedBy?: string
  recurrence?: Recurrence
  setInspectedBy?: (v: string) => void
  setRecurrence?: (v: Recurrence) => void
}) {
  const setInspectedBy = overrides?.setInspectedBy ?? vi.fn()
  const setRecurrence = overrides?.setRecurrence ?? vi.fn()
  render(
    <MetadataSection
      inspectedBy={overrides?.inspectedBy ?? ""}
      setInspectedBy={setInspectedBy}
      recurrence={overrides?.recurrence ?? "yearly"}
      setRecurrence={setRecurrence}
    />,
  )
  return { setInspectedBy, setRecurrence }
}

describe("MetadataSection", () => {
  test("renders inspector textfield with current value", () => {
    setup({ inspectedBy: "Alice" })
    expect(screen.getByLabelText("Inspected by")).toHaveValue("Alice")
  })

  test("propagates keystrokes through setInspectedBy", async () => {
    const setInspectedBy = vi.fn()
    const user = userEvent.setup()
    setup({ setInspectedBy })
    await user.type(screen.getByLabelText("Inspected by"), "B")
    expect(setInspectedBy).toHaveBeenCalledWith("B")
  })

  test("calls setRecurrence when the cadence is changed", async () => {
    const setRecurrence = vi.fn()
    const user = userEvent.setup()
    setup({ setRecurrence })
    await user.selectOptions(screen.getByLabelText("Cadence"), "5year")
    expect(setRecurrence).toHaveBeenCalledWith("5year")
  })

  test("renders all four cadence options", () => {
    setup()
    const select = screen.getByLabelText("Cadence") as HTMLSelectElement
    const values = Array.from(select.options).map(o => o.value)
    expect(values).toEqual(["yearly", "5year", "spring", "fall"])
  })
})
