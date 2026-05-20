import { Switch } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useColorScheme } from "@/hooks/useColorScheme"

export default function ColorSchemeToggle() {
  const { t } = useTranslation("core")
  const { scheme, toggle } = useColorScheme()

  return (
    <Switch
      label={t("Dark mode")}
      checked={scheme === "dark"}
      onChange={toggle}
    />
  )
}
