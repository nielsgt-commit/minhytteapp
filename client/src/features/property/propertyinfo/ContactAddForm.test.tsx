import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { ContactAddForm } from "./ContactAddForm.tsx"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

describe("ContactAddForm", () => {
  test("renders Name, Phone, Email, Info fields and submit/cancel buttons", () => {
    render(
      <ContactAddForm
        createPending={false}
        onSubmit={async () => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByLabelText("Name")).toBeInTheDocument()
    expect(screen.getByLabelText("Phone")).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Info")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Add contact" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
  })

  test("Phone has type=tel and Email has type=email", () => {
    render(
      <ContactAddForm
        createPending={false}
        onSubmit={async () => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByLabelText("Phone")).toHaveAttribute("type", "tel")
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email")
  })

  test("disables all inputs and both buttons while createPending", () => {
    render(
      <ContactAddForm
        createPending={true}
        onSubmit={async () => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByLabelText("Name")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Add contact" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  })

  test("clicking Cancel invokes onCancel", async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <ContactAddForm
        createPending={false}
        onSubmit={async () => {}}
        onCancel={onCancel}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  test("submitting the form invokes onSubmit with the form data", async () => {
    const onSubmit = vi.fn(async (_fd: FormData) => {})
    const user = userEvent.setup()
    render(
      <ContactAddForm
        createPending={false}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    )
    await user.type(screen.getByLabelText("Name"), "Caretaker")
    await user.click(screen.getByRole("button", { name: "Add contact" }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    const fd = onSubmit.mock.calls[0]?.[0]
    expect(fd.get("name")).toBe("Caretaker")
  })
})
