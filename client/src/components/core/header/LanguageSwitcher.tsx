import { useTranslation } from "react-i18next"
import { Button } from "@digdir/designsystemet-react"
import { GlobeIcon } from "@navikt/aksel-icons"
import { useSwitchLocale } from "@/hooks/useLocalizedNavigate"

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation("core")
  const switchLocale = useSwitchLocale()
  const current = i18n.resolvedLanguage === "nb" ? "nb" : "en"
  const next = current === "nb" ? "en" : "nb"
  const nextLabel = next === "nb" ? "Norsk" : "English"

  return (
    <Button
      variant="tertiary"
      aria-label={t("Switch language to {{label}}", { label: nextLabel })}
      onClick={() => {
        switchLocale(next)
      }}
    >
      <GlobeIcon aria-hidden />
      {current.toUpperCase()}
    </Button>
  )
}
