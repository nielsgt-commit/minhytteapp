import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { MetadataSection } from "./MetadataSection.tsx"
import type { CadenceValue } from "./inspectionCadence.ts"
import type { PriorityOwner } from "@/features/maintenance/due/MaintenanceDueSelect.tsx"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const owners: PriorityOwner[] = [
  { user_group_id: 7, user_group_name: "Hansen" },
]

function setup(value: CadenceValue = { recurrence: "spring" }) {
  const onChange = vi.fn()
  render(<MetadataSection value={value} owners={owners} onChange={onChange} />)
  return { onChange }
}

describe("MetadataSection", () => {
  test("does not render an inspector field (inspected-by is implicit)", () => {
    setup()
    expect(screen.queryByLabelText("Inspected by")).not.toBeInTheDocument()
  })

  test("offers the seasonal + event cadences and each family group's week", () => {
    setup()
    const select = screen.getByLabelText("Cadence") as HTMLSelectElement
    const values = Array.from(select.options).map(o => o.value)
    expect(values).toEqual([
      "spring",
      "fall",
      "dugnad",
      "opening",
      "closing",
      "group:7",
    ])
  })

  test("does not offer the legacy yearly cadence", () => {
    setup()
    const select = screen.getByLabelText("Cadence") as HTMLSelectElement
    const values = Array.from(select.options).map(o => o.value)
    expect(values).not.toContain("yearly")
    expect(values).not.toContain("5year")
  })

  test("reflects the current value", () => {
    setup({ recurrence: "opening" })
    expect(screen.getByLabelText("Cadence")).toHaveValue("opening")
  })

  test("emits the selected static cadence", async () => {
    const user = userEvent.setup()
    const { onChange } = setup()
    await user.selectOptions(screen.getByLabelText("Cadence"), "dugnad")
    expect(onChange).toHaveBeenCalledWith({ recurrence: "dugnad" })
  })

  test("emits a priority_week cadence with the group id", async () => {
    const user = userEvent.setup()
    const { onChange } = setup()
    await user.selectOptions(screen.getByLabelText("Cadence"), "group:7")
    expect(onChange).toHaveBeenCalledWith({
      recurrence: "priority_week",
      cadence_priority_group_id: 7,
    })
  })
})
