import { useState } from "react"
import {
  Alert,
  Button,
  Card,
  Details,
  Heading,
  List,
  Paragraph,
  Textfield,
  ValidationMessage,
} from "@digdir/designsystemet-react"
import { Trans, useTranslation } from "react-i18next"
import { signIn } from "@/auth/auth-client"
import { usePwaInstall } from "@/hooks/usePwaInstall"
import styles from "./Home.module.css"

export function UnauthenticatedView() {
  const { t } = useTranslation("home")
  const { platform, isStandalone } = usePwaInstall()
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  )
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus("sending")
    setErrorMsg(null)
    const { error } = await signIn.magicLink({
      email,
      callbackURL: "/dashboard",
    })
    if (error) {
      setStatus("error")
      setErrorMsg(error.message ?? t("Could not send magic link"))
      return
    }
    setStatus("sent")
  }

  if (status === "sent") {
    return (
      <Card color="neutral" className={styles.card}>
        <Heading level={2}>{t("Check your email")}</Heading>
        <Paragraph>
          <Trans
            i18nKey="We sent a sign-in link to <1>{{email}}</1>. Click it to continue."
            ns="home"
            values={{ email }}
            components={{ 1: <strong /> }}
          />
        </Paragraph>
      </Card>
    )
  }

  return (
    <Card color="neutral" className={styles.card}>
      <Alert data-color="info" data-size="sm">
        {t(
          "The app is still being tested, so the first load can take up to a minute while the server wakes up. After that it's fast — thanks for your patience!",
        )}
      </Alert>
      <form
        className={styles.form}
        onSubmit={e => {
          void handleSubmit(e)
        }}
      >
        <Textfield
          type="email"
          required
          aria-label={t("Email")}
          placeholder={t("you@example.com")}
          value={email}
          onChange={e => {
            setEmail(e.target.value)
          }}
          disabled={status === "sending"}
        />
        <Button type="submit" disabled={status === "sending" || !email}>
          {status === "sending" ? t("Sending…") : t("Send magic link")}
        </Button>
      </form>
      {errorMsg ? (
        <ValidationMessage role="alert">{errorMsg}</ValidationMessage>
      ) : null}
      {!isStandalone && platform !== "other" ? (
        <Details>
          <Details.Summary>
            {t("Install the app on your phone")}
          </Details.Summary>
          <Details.Content>
            <Paragraph data-size="sm">
              {t(
                "Add minhytte.app to your home screen for an app-like experience.",
              )}
            </Paragraph>
            {platform === "ios" ? (
              <List.Ordered data-size="sm">
                <List.Item>{t("Open minhytte.app in Safari.")}</List.Item>
                <List.Item>
                  {t("Tap the Share button (the square with an arrow).")}
                </List.Item>
                <List.Item>{t("Choose “Add to Home Screen”.")}</List.Item>
                <List.Item>{t("Tap “Add” to confirm.")}</List.Item>
              </List.Ordered>
            ) : (
              <List.Ordered data-size="sm">
                <List.Item>{t("Open minhytte.app in Chrome.")}</List.Item>
                <List.Item>{t("Tap the menu (⋮) in the top right.")}</List.Item>
                <List.Item>
                  {t("Choose “Add to Home screen” or “Install app”.")}
                </List.Item>
                <List.Item>{t("Tap “Install” to confirm.")}</List.Item>
              </List.Ordered>
            )}
          </Details.Content>
        </Details>
      ) : null}
    </Card>
  )
}
