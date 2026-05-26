import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useFormSubmit } from "./useFormSubmit"

function NameForm({
  parse,
  onSubmit,
}: {
  parse: (fd: FormData) => { name: string } | null
  onSubmit: (data: { name: string }) => void
}) {
  const handleSubmit = useFormSubmit(parse, onSubmit)
  return (
    <form onSubmit={handleSubmit}>
      <input name="name" defaultValue="ada" />
      <button type="submit">Save</button>
    </form>
  )
}

describe("useFormSubmit", () => {
  test("parses FormData and calls onSubmit", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const parse = (fd: FormData) => ({ name: String(fd.get("name") ?? "") })

    render(<NameForm parse={parse} onSubmit={onSubmit} />)
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(onSubmit).toHaveBeenCalledWith({ name: "ada" })
  })

  test("prevents default submit behavior", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    let defaultPrevented = false
    const handleNativeSubmit = (e: Event) => {
      defaultPrevented = e.defaultPrevented
    }
    document.addEventListener("submit", handleNativeSubmit)

    try {
      render(<NameForm parse={() => ({ name: "x" })} onSubmit={onSubmit} />)
      await user.click(screen.getByRole("button", { name: "Save" }))
      expect(defaultPrevented).toBe(true)
    } finally {
      document.removeEventListener("submit", handleNativeSubmit)
    }
  })

  test("skips onSubmit when parse returns null", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<NameForm parse={() => null} onSubmit={onSubmit} />)
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  test("parsed null is distinct from a falsy-but-valid value", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    // 0 is a valid payload but falsy — must still submit.
    function ZeroForm() {
      const handle = useFormSubmit<number>(() => 0, onSubmit)
      return (
        <form onSubmit={handle}>
          <button type="submit">Go</button>
        </form>
      )
    }

    render(<ZeroForm />)
    await user.click(screen.getByRole("button", { name: "Go" }))

    expect(onSubmit).toHaveBeenCalledWith(0)
  })
})
