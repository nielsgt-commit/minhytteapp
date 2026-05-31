import { useState } from "react"
import {
  Button,
  Card,
  Heading,
  Paragraph,
  Textfield,
  ValidationMessage,
} from "@digdir/designsystemet-react"
import { Trans, useTranslation } from "react-i18next"
import { signIn } from "@/auth/auth-client"
import styles from "./Home.module.css"

export function UnauthenticatedView() {
  const { t } = useTranslation("home")
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
            i18nKey="We sent a sign-in link to <1>{{email}}</1>. Click it to continue. (In dev, the link is printed to the API server console.)"
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
      <form
        className={styles.form}
        onSubmit={e => {
          void handleSubmit(e)
        }}
      >
        <Textfield
          type="email"
          required
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
    </Card>
  )
}
