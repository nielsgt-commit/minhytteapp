import Navigation from "@/components/shared/Navigation"
import ContactsSummary from "@/features/dashboard/contactssummary/ContactsSummary.tsx"
import { useTranslation } from "react-i18next"

export default function Footer() {
  const { t, i18n } = useTranslation("core")
  return (
    <footer style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <h1>{t("Footer")}</h1>
        <Navigation />
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
      </div>
      <ContactsSummary />
    </footer>
  )
}
