import { useTranslation } from "react-i18next"
import { Button } from "@digdir/designsystemet-react"
import { GlobeIcon } from "@navikt/aksel-icons"

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation("core")
  const current = i18n.resolvedLanguage === "nb" ? "nb" : "en"
  const next = current === "nb" ? "en" : "nb"
  const nextLabel = next === "nb" ? "Norsk" : "English"

  return (
    <Button
      variant="tertiary"
      aria-label={t("Switch language to {{label}}", { label: nextLabel })}
      onClick={() => {
        void i18n.changeLanguage(next)
      }}
    >
      <GlobeIcon aria-hidden />
      {current.toUpperCase()}
    </Button>
  )
}
