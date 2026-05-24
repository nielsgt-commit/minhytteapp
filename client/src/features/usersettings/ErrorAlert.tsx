import { useTranslation } from "react-i18next"

type ErrorAlertProps = {
  error: { message: string } | null | undefined
}

export function ErrorAlert({ error }: ErrorAlertProps) {
  const { t } = useTranslation("usersettings")
  if (!error) return null
  return <p role="alert">{t("Error: {{message}}", { message: error.message })}</p>
}
