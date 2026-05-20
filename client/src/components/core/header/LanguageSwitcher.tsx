import { useTranslation } from "react-i18next"

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation("core")
  return (
    <label>
      {t("Language")}{" "}
      <select
        value={i18n.resolvedLanguage}
        onChange={(e) => {
          void i18n.changeLanguage(e.target.value)
        }}
      >
        <option value="en">English</option>
        <option value="nb">Norsk</option>
      </select>
    </label>
  )
}
