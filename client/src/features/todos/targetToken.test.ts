import { describe, expect, test } from "vitest"
import { NO_TARGET, parseTargetToken } from "./targetToken"

describe("parseTargetToken", () => {
  test("parses all three target kinds", () => {
    expect(parseTargetToken("structure:5")).toEqual({
      kind: "structure",
      id: 5,
    })
    expect(parseTargetToken("infrastructure:12")).toEqual({
      kind: "infrastructure",
      id: 12,
    })
    expect(parseTargetToken("equipment:3")).toEqual({
      kind: "equipment",
      id: 3,
    })
  })

  test("the empty NO_TARGET token means no target", () => {
    expect(parseTargetToken(NO_TARGET)).toBeUndefined()
  })

  test("rejects unknown kinds, bad ids and malformed tokens", () => {
    expect(parseTargetToken("room:5")).toBeUndefined()
    expect(parseTargetToken("structure:abc")).toBeUndefined()
    expect(parseTargetToken("structure:0")).toBeUndefined()
    expect(parseTargetToken("structure:-3")).toBeUndefined()
    expect(parseTargetToken("structure")).toBeUndefined()
    expect(parseTargetToken("structure:")).toBeUndefined()
  })
})
