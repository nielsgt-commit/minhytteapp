import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { MetadataSection } from "./MetadataSection.tsx"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

function setup() {
  render(<MetadataSection />)
}

describe("MetadataSection", () => {
  test("does not render an inspector field (inspected-by is implicit)", () => {
    setup()
    expect(screen.queryByLabelText("Inspected by")).not.toBeInTheDocument()
  })

  test("cadence is named for FormData submission", () => {
    setup()
    expect(screen.getByLabelText("Cadence")).toHaveAttribute(
      "name",
      "recurrence",
    )
  })

  test("cadence defaults to yearly and can be changed", async () => {
    const user = userEvent.setup()
    setup()
    const select = screen.getByLabelText("Cadence")
    expect(select).toHaveValue("yearly")
    await user.selectOptions(select, "5year")
    expect(select).toHaveValue("5year")
  })

  test("renders all four cadence options", () => {
    setup()
    const select = screen.getByLabelText("Cadence") as HTMLSelectElement
    const values = Array.from(select.options).map(o => o.value)
    expect(values).toEqual(["yearly", "5year", "spring", "fall"])
  })
})
