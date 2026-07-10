// Localized URL aliases for the router's rewrite option (see main.tsx).
//
// The route tree is Norwegian-canonical: every route file uses the NB path,
// and internal navigation targets NB route ids. English URLs exist only as
// display/deep-link aliases: the router's `rewrite.input` canonicalizes an
// EN pathname to NB before matching, and `rewrite.output` localizes the NB
// pathname back to EN in the address bar (and Link hrefs) when the active
// language is English.
//
// Pairs are matched as whole path segments, longest NB/EN prefix first, so
// "/innstillinger" (user settings) never swallows
// "/administrer/innstillinger" (admin settings). A pair whose child segment
// is identical in both languages (e.g. /administrer/info) needs no entry —
// the parent prefix swap carries the suffix through.
export const LOCALIZED_PATHS: readonly (readonly [nb: string, en: string])[] = [
  // Admin children whose segment names differ between languages.
  ["/administrer/invitasjoner", "/manageproperty/invites"],
  ["/administrer/kontakter", "/manageproperty/contacts"],
  ["/administrer/prioritet", "/manageproperty/priority"],
  ["/administrer/bygninger", "/manageproperty/structures"],
  ["/administrer/brukere", "/manageproperty/users"],
  ["/administrer/brukergrupper", "/manageproperty/usergroups"],
  ["/administrer/utstyr", "/manageproperty/equipment"],
  ["/administrer/innstillinger", "/manageproperty/settings"],
  ["/administrer/eierskap", "/manageproperty/ownership"],
  ["/administrer/infrastruktur", "/manageproperty/infrastructure"],
  ["/administrer/fordelingspolicy", "/manageproperty/split-policy"],
  ["/administrer/sesonger", "/manageproperty/seasons"],
  ["/administrer/utgiftskategorier", "/manageproperty/expensecategories"],
  // Top-level pages.
  ["/administrer", "/manageproperty"],
  ["/oppgaver", "/todos"],
  ["/oversikt", "/dashboard"],
  ["/planleggopphold", "/planstay"],
  ["/utlegg", "/expenses"],
  ["/vedlikehold", "/maintenance"],
  ["/oppgjor", "/settlement"],
  ["/handleliste", "/shoppinglist"],
  ["/innstillinger", "/usersettings"],
]

function matchesAtSegmentBoundary(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/")
}

function swapPrefix(
  pathname: string,
  from: (pair: (typeof LOCALIZED_PATHS)[number]) => string,
  to: (pair: (typeof LOCALIZED_PATHS)[number]) => string,
): string {
  let best: (typeof LOCALIZED_PATHS)[number] | undefined
  for (const pair of LOCALIZED_PATHS) {
    if (
      matchesAtSegmentBoundary(pathname, from(pair)) &&
      (best === undefined || from(pair).length > from(best).length)
    ) {
      best = pair
    }
  }
  if (best === undefined) return pathname
  return to(best) + pathname.slice(from(best).length)
}

/** Browser URL → internal URL: canonicalize an EN pathname to its NB route. */
export function toCanonicalPath(pathname: string): string {
  return swapPrefix(
    pathname,
    pair => pair[1],
    pair => pair[0],
  )
}

/** Internal URL → address bar: localize the NB pathname for the language. */
export function toPublicPath(pathname: string, locale: "en" | "nb"): string {
  if (locale !== "en") return pathname
  return swapPrefix(
    pathname,
    pair => pair[0],
    pair => pair[1],
  )
}
