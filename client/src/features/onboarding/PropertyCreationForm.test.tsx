import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { PropertyCreationForm } from "./PropertyCreationForm"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe("PropertyCreationForm", () => {
  test("renders name + address fields and the submit button", () => {
    render(<PropertyCreationForm pending={false} onSubmit={() => {}} />)
    expect(screen.getByLabelText("Name")).toBeInTheDocument()
    expect(screen.getByLabelText("Address")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Create property" }),
    ).toBeInTheDocument()
  })

  test("submits typed name and address", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<PropertyCreationForm pending={false} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText("Name"), "The Cabin")
    await user.type(screen.getByLabelText("Address"), "1 Mountain Rd")
    await user.click(screen.getByRole("button", { name: "Create property" }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      name: "The Cabin",
      address: "1 Mountain Rd",
    })
  })

  test("disables the submit button while pending", () => {
    render(<PropertyCreationForm pending={true} onSubmit={() => {}} />)
    expect(
      screen.getByRole("button", { name: "Create property" }),
    ).toBeDisabled()
  })

  test("does not call onSubmit when required fields are empty", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<PropertyCreationForm pending={false} onSubmit={onSubmit} />)

    await user.click(screen.getByRole("button", { name: "Create property" }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test("renders the step 2 legend", () => {
    render(<PropertyCreationForm pending={false} onSubmit={() => {}} />)
    expect(screen.getByText("Step 2 – Add the property")).toBeInTheDocument()
  })

  test("can be submitted multiple times with new values", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<PropertyCreationForm pending={false} onSubmit={onSubmit} />)

    const nameField = screen.getByLabelText("Name")
    const addressField = screen.getByLabelText("Address")

    await user.type(nameField, "First")
    await user.type(addressField, "Addr 1")
    await user.click(screen.getByRole("button", { name: "Create property" }))

    await user.clear(nameField)
    await user.clear(addressField)
    await user.type(nameField, "Second")
    await user.type(addressField, "Addr 2")
    await user.click(screen.getByRole("button", { name: "Create property" }))

    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(onSubmit).toHaveBeenNthCalledWith(1, {
      name: "First",
      address: "Addr 1",
    })
    expect(onSubmit).toHaveBeenNthCalledWith(2, {
      name: "Second",
      address: "Addr 2",
    })
  })
})
