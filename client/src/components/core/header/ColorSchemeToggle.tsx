import { Button } from "@digdir/designsystemet-react"
import { MoonIcon, SunIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import { useColorScheme } from "@/hooks/useColorScheme"

export default function ColorSchemeToggle() {
  const { t } = useTranslation("core")
  const { scheme, toggle } = useColorScheme()
  const isDark = scheme === "dark"

  return (
    <Button
      variant="tertiary"
      aria-label={isDark ? t("Switch to light mode") : t("Switch to dark mode")}
      onClick={toggle}
    >
      {isDark ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
      {isDark ? t("Light mode") : t("Dark mode")}
    </Button>
  )
}
