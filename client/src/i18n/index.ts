import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"

import enPlanstay from "./locales/en/planstay.json"
import enCheckin from "./locales/en/checkin.json"
import enCommon from "./locales/en/common.json"
import enCore from "./locales/en/core.json"
import enDashboard from "./locales/en/dashboard.json"
import enExpenses from "./locales/en/expenses.json"
import enHome from "./locales/en/home.json"
import enLayouts from "./locales/en/layouts.json"
import enMaintenance from "./locales/en/maintenance.json"
import enOnboarding from "./locales/en/onboarding.json"
import enPriority from "./locales/en/priority.json"
import enProperty from "./locales/en/property.json"
import enSettlement from "./locales/en/settlement.json"
import enShared from "./locales/en/shared.json"
import enUser from "./locales/en/user.json"
import enUsergroups from "./locales/en/usergroups.json"
import enUsersettings from "./locales/en/usersettings.json"

import nbPlanstay from "./locales/nb/planstay.json"
import nbCheckin from "./locales/nb/checkin.json"
import nbCommon from "./locales/nb/common.json"
import nbCore from "./locales/nb/core.json"
import nbDashboard from "./locales/nb/dashboard.json"
import nbExpenses from "./locales/nb/expenses.json"
import nbHome from "./locales/nb/home.json"
import nbLayouts from "./locales/nb/layouts.json"
import nbMaintenance from "./locales/nb/maintenance.json"
import nbOnboarding from "./locales/nb/onboarding.json"
import nbPriority from "./locales/nb/priority.json"
import nbProperty from "./locales/nb/property.json"
import nbSettlement from "./locales/nb/settlement.json"
import nbShared from "./locales/nb/shared.json"
import nbUser from "./locales/nb/user.json"
import nbUsergroups from "./locales/nb/usergroups.json"
import nbUsersettings from "./locales/nb/usersettings.json"

export const defaultNS = "common"

export const resources = {
  en: {
    planstay: enPlanstay,
    checkin: enCheckin,
    common: enCommon,
    core: enCore,
    dashboard: enDashboard,
    expenses: enExpenses,
    home: enHome,
    layouts: enLayouts,
    maintenance: enMaintenance,
    onboarding: enOnboarding,
    priority: enPriority,
    property: enProperty,
    settlement: enSettlement,
    shared: enShared,
    user: enUser,
    usergroups: enUsergroups,
    usersettings: enUsersettings,
  },
  nb: {
    planstay: nbPlanstay,
    checkin: nbCheckin,
    common: nbCommon,
    core: nbCore,
    dashboard: nbDashboard,
    expenses: nbExpenses,
    home: nbHome,
    layouts: nbLayouts,
    maintenance: nbMaintenance,
    onboarding: nbOnboarding,
    priority: nbPriority,
    property: nbProperty,
    settlement: nbSettlement,
    shared: nbShared,
    user: nbUser,
    usergroups: nbUsergroups,
    usersettings: nbUsersettings,
  },
} as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "nb",
    supportedLngs: ["en", "nb"],
    defaultNS,
    ns: [
      "planstay",
      "checkin",
      "common",
      "core",
      "dashboard",
      "expenses",
      "home",
      "layouts",
      "maintenance",
      "onboarding",
      "priority",
      "property",
      "settlement",
      "shared",
      "user",
      "usergroups",
      "usersettings",
    ],
    interpolation: { escapeValue: false },
    // Natural-key strategy: the English sentence IS the key, so disable
    // separators that would otherwise split keys on '.' or ':'.
    keySeparator: false,
    nsSeparator: false,
    returnNull: false,
    returnEmptyString: false,
    detection: {
      order: ["localStorage"],
      caches: ["localStorage"],
    },
  })

export default i18n
