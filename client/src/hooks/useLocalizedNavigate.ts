import { useNavigate, useLocation } from "@tanstack/react-router"
import { getEquivalentRoute } from "@/i18n/routeEquivalents"
import i18next from "i18next"

export function useSwitchLocale() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (targetLocale: 'en' | 'nb') => {
    void i18next.changeLanguage(targetLocale)
    const target = getEquivalentRoute(pathname, targetLocale)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void navigate({ to: target as any })
  }
}
