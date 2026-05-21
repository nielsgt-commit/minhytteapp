import Navigation from "@/components/shared/Navigation"
import ContactsSummary from "@/features/dashboard/contactssummary/ContactsSummary.tsx"
import { useTranslation } from "react-i18next"
import styles from "./Footer.module.css"

export default function Footer() {
  const { t, i18n } = useTranslation("core")
  return (
    <footer className={styles.footer}>
      <div className={styles.row}>
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
