import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { MetadataSection } from "./MetadataSection.tsx"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

function setup(defaultInspectedBy = "") {
  render(<MetadataSection defaultInspectedBy={defaultInspectedBy} />)
}

describe("MetadataSection", () => {
  test("renders inspector textfield with the default value", () => {
    setup("Alice")
    expect(screen.getByLabelText("Inspected by")).toHaveValue("Alice")
  })

  test("inspector field is uncontrolled and editable", async () => {
    const user = userEvent.setup()
    setup()
    const field = screen.getByLabelText("Inspected by")
    await user.type(field, "Bob")
    expect(field).toHaveValue("Bob")
  })

  test("fields are named for FormData submission", () => {
    setup()
    expect(screen.getByLabelText("Inspected by")).toHaveAttribute(
      "name",
      "inspected_by",
    )
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
