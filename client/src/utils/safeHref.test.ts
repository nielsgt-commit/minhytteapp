import { describe, expect, test } from "vitest"
import { safeHref } from "./safeHref.ts"

describe("safeHref", () => {
  test("returns null for null, undefined, empty, whitespace", () => {
    expect(safeHref(null)).toBeNull()
    expect(safeHref(undefined)).toBeNull()
    expect(safeHref("")).toBeNull()
    expect(safeHref("   ")).toBeNull()
  })

  test("rejects javascript: URLs", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull()
    expect(safeHref("JAVASCRIPT:alert(1)")).toBeNull()
  })

  test("rejects data: URLs", () => {
    expect(safeHref("data:text/html,<script>x</script>")).toBeNull()
  })

  test("rejects relative paths and bare hosts", () => {
    expect(safeHref("/foo")).toBeNull()
    expect(safeHref("example.com")).toBeNull()
  })

  test("accepts http/https/mailto/tel", () => {
    expect(safeHref("https://example.com/x?y=1")).toBe(
      "https://example.com/x?y=1",
    )
    expect(safeHref("http://example.com")).toBe("http://example.com/")
    expect(safeHref("mailto:a@b.no")).toBe("mailto:a@b.no")
    expect(safeHref("tel:+4712345678")).toBe("tel:+4712345678")
  })

  test("trims surrounding whitespace", () => {
    expect(safeHref("  https://example.com  ")).toBe("https://example.com/")
  })
})
