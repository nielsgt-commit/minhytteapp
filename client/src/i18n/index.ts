import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"

import enCommon from "./locales/en/common.json"
import enCalendar from "./locales/en/calendar.json"
import nbCommon from "./locales/nb/common.json"
import nbCalendar from "./locales/nb/calendar.json"

export const defaultNS = "common"

export const resources = {
  en: { common: enCommon, calendar: enCalendar },
  nb: { common: nbCommon, calendar: nbCalendar },
} as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: ["en", "nb"],
    defaultNS,
    ns: ["common", "calendar"],
    interpolation: { escapeValue: false },
    // Natural-key strategy: the English sentence IS the key, so disable
    // separators that would otherwise split keys on '.' or ':'.
    keySeparator: false,
    nsSeparator: ":",
    returnNull: false,
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
    },
  })

export default i18n
