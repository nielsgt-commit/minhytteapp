import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { ContactEditForm } from "./ContactEditForm.tsx"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

const contact = {
  id: 11,
  property_id: 1,
  name: "Caretaker",
  phone: "12345678",
  email: "care@example.com",
  info: "Has spare keys",
}

const noop = () => {}
const preventDefault = (e: React.SyntheticEvent<HTMLFormElement>) => {
  e.preventDefault()
}

describe("ContactEditForm", () => {
  test("pre-fills inputs from the contact prop", () => {
    render(
      <ContactEditForm
        contact={contact}
        pending={false}
        updatePending={false}
        onSubmit={preventDefault}
        onDelete={noop}
        onCancel={noop}
      />,
    )
    expect(screen.getByLabelText("Name")).toHaveValue("Caretaker")
    expect(screen.getByLabelText("Phone")).toHaveValue("12345678")
    expect(screen.getByLabelText("Email")).toHaveValue("care@example.com")
    expect(screen.getByLabelText("Info")).toHaveValue("Has spare keys")
  })

  test("uses empty strings for null fields", () => {
    render(
      <ContactEditForm
        contact={{ ...contact, phone: null, email: null, info: null }}
        pending={false}
        updatePending={false}
        onSubmit={preventDefault}
        onDelete={noop}
        onCancel={noop}
      />,
    )
    expect(screen.getByLabelText("Phone")).toHaveValue("")
    expect(screen.getByLabelText("Email")).toHaveValue("")
  })

  test("Remove calls onDelete, Cancel calls onCancel", async () => {
    const onDelete = vi.fn()
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <ContactEditForm
        contact={contact}
        pending={false}
        updatePending={false}
        onSubmit={preventDefault}
        onDelete={onDelete}
        onCancel={onCancel}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Remove" }))
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  test("all buttons disabled when pending=true", () => {
    render(
      <ContactEditForm
        contact={contact}
        pending={true}
        updatePending={false}
        onSubmit={preventDefault}
        onDelete={noop}
        onCancel={noop}
      />,
    )
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  })
})
