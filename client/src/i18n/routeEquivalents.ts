export const ROUTE_EQUIVALENTS: Record<string, { en: string; nb: string }> = {
  '/oversikt':       { en: '/dashboard',     nb: '/oversikt' },
  '/dashboard':      { en: '/dashboard',     nb: '/oversikt' },
  '/kalender':       { en: '/calendar',      nb: '/kalender' },
  '/calendar':       { en: '/calendar',      nb: '/kalender' },
  '/utlegg':         { en: '/expenses',      nb: '/utlegg' },
  '/expenses':       { en: '/expenses',      nb: '/utlegg' },
  '/vedlikehold':    { en: '/maintenance',   nb: '/vedlikehold' },
  '/maintenance':    { en: '/maintenance',   nb: '/vedlikehold' },
  '/oppgjor':        { en: '/settlement',    nb: '/oppgjor' },
  '/settlement':     { en: '/settlement',    nb: '/oppgjor' },
  '/innstillinger':  { en: '/usersettings',  nb: '/innstillinger' },
  '/usersettings':   { en: '/usersettings',  nb: '/innstillinger' },
  '/administrer':    { en: '/manageproperty', nb: '/administrer' },
  '/manageproperty': { en: '/manageproperty', nb: '/administrer' },
  '/administrer/invitasjoner': { en: '/manageproperty/invites', nb: '/administrer/invitasjoner' },
  '/manageproperty/invites':   { en: '/manageproperty/invites', nb: '/administrer/invitasjoner' },
}

export function getEquivalentRoute(path: string, targetLocale: 'en' | 'nb'): string {
  const entry = ROUTE_EQUIVALENTS[path]
  return entry ? entry[targetLocale] : path
}
