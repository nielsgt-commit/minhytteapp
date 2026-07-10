import { describe, expect, it } from "vitest"
import {
  LOCALIZED_PATHS,
  toCanonicalPath,
  toPublicPath,
} from "./localizedPaths"

describe("localizedPaths", () => {
  it("round-trips every pair in both directions", () => {
    for (const [nb, en] of LOCALIZED_PATHS) {
      expect(toCanonicalPath(en)).toBe(nb)
      expect(toPublicPath(nb, "en")).toBe(en)
    }
  })

  it("keeps NB paths unchanged for the nb locale", () => {
    for (const [nb] of LOCALIZED_PATHS) {
      expect(toPublicPath(nb, "nb")).toBe(nb)
    }
  })

  it("resolves the /innstillinger vs /administrer/innstillinger trap", () => {
    expect(toPublicPath("/innstillinger", "en")).toBe("/usersettings")
    expect(toPublicPath("/administrer/innstillinger", "en")).toBe(
      "/manageproperty/settings",
    )
    expect(toCanonicalPath("/usersettings")).toBe("/innstillinger")
    expect(toCanonicalPath("/manageproperty/settings")).toBe(
      "/administrer/innstillinger",
    )
  })

  it("passes unmapped paths through untouched", () => {
    for (const path of ["/", "/onboarding", "/unknown"]) {
      expect(toCanonicalPath(path)).toBe(path)
      expect(toPublicPath(path, "en")).toBe(path)
      expect(toPublicPath(path, "nb")).toBe(path)
    }
  })

  it("only matches whole path segments, never substrings", () => {
    // "/todosarkiv" must not match the "/todos" prefix.
    expect(toCanonicalPath("/todosarkiv")).toBe("/todosarkiv")
    expect(toPublicPath("/oppgaverliste", "en")).toBe("/oppgaverliste")
  })

  it("carries unmapped suffixes through a mapped parent prefix", () => {
    // Child segment identical in both languages: parent swap carries it.
    expect(toCanonicalPath("/manageproperty/info")).toBe("/administrer/info")
    expect(toPublicPath("/administrer/info", "en")).toBe("/manageproperty/info")
    // Nested page under a mapped child prefix.
    expect(toCanonicalPath("/manageproperty/split-policy/persondays")).toBe(
      "/administrer/fordelingspolicy/persondays",
    )
    expect(toPublicPath("/administrer/fordelingspolicy/persondays", "en")).toBe(
      "/manageproperty/split-policy/persondays",
    )
  })
})
