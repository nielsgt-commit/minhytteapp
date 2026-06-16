import { createFileRoute, Link, Outlet } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { SplitPolicyProvider } from "@/features/settlement/splitpolicybuilder/SplitPolicyContext"
import styles from "./fordelingspolicy.module.css"

export const Route = createFileRoute("/_authed/administrer/fordelingspolicy")({
  component: FordelingsPolicyLayout,
})

function FordelingsPolicyLayout() {
  const { t } = useTranslation("settlement")
  return (
    <SplitPolicyProvider>
      <nav className={styles.subnav} aria-label={t("Split policy sections")}>
        <Link
          to="/administrer/fordelingspolicy"
          activeOptions={{ exact: true }}
          className={styles.link}
          activeProps={{ className: styles.active }}
        >
          {t("Policy")}
        </Link>
        <Link
          to="/administrer/fordelingspolicy/persondays"
          className={styles.link}
          activeProps={{ className: styles.active }}
        >
          {t("Person days")}
        </Link>
      </nav>
      <Outlet />
    </SplitPolicyProvider>
  )
}
