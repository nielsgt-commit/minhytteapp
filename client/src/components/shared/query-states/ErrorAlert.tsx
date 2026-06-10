import { Alert, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"

type Props = {
  error: { message: string } | null
}

export function ErrorAlert({ error }: Props) {
  const { t } = useTranslation("shared")
  if (!error) return null
  return (
    <Alert data-color="danger" role="alert">
      <Paragraph>{t("Something went wrong")}</Paragraph>
      <Paragraph>{error.message}</Paragraph>
    </Alert>
  )
}
