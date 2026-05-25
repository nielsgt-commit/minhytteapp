import { render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"
import type { PortableTextBlock } from "@portabletext/types"
import { MaintenanceInstructionsPT } from "./MaintenanceInstructionsPT.tsx"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const para = (text: string, key = "k"): PortableTextBlock => ({
  _type: "block",
  _key: key,
  style: "normal",
  markDefs: [],
  children: [{ _type: "span", _key: `${key}-s`, text, marks: [] }],
})

describe("MaintenanceInstructionsPT", () => {
  test("renders empty-state copy for null value", () => {
    render(<MaintenanceInstructionsPT value={null} />)
    expect(screen.getByText("No instructions.")).toBeInTheDocument()
  })

  test("renders empty-state copy for empty array", () => {
    render(<MaintenanceInstructionsPT value={[]} />)
    expect(screen.getByText("No instructions.")).toBeInTheDocument()
  })

  test("renders a normal paragraph block", () => {
    render(<MaintenanceInstructionsPT value={[para("Hello world", "p1")]} />)
    expect(screen.getByText("Hello world")).toBeInTheDocument()
  })

  test("renders heading-2 style as <h2>", () => {
    const block: PortableTextBlock = {
      _type: "block",
      _key: "h",
      style: "h2",
      markDefs: [],
      children: [{ _type: "span", _key: "hs", text: "Heading", marks: [] }],
    }
    const { container } = render(<MaintenanceInstructionsPT value={[block]} />)
    expect(container.querySelector("h2")?.textContent).toBe("Heading")
  })

  test("renders a photo block as <img> with alt fallback to caption", () => {
    const block = {
      _type: "photo",
      _key: "ph",
      url: "https://example.com/img.png",
      caption: "A caption",
    } as unknown as PortableTextBlock
    const { container } = render(<MaintenanceInstructionsPT value={[block]} />)
    const img = container.querySelector("img")
    expect(img).not.toBeNull()
    expect(img?.getAttribute("src")).toBe("https://example.com/img.png")
    expect(img?.getAttribute("alt")).toBe("A caption")
  })
})
