import { useState } from "react"
import { Button, Paragraph } from "@digdir/designsystemet-react"
import { Trans, useTranslation } from "react-i18next"
import { signIn } from "@/auth/auth-client"

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
      <>
        <h2>{t("Check your email")}</h2>
        <p>
          <Trans
            i18nKey="We sent a sign-in link to <1>{{email}}</1>. Click it to continue. (In dev, the link is printed to the API server console.)"
            ns="home"
            values={{ email }}
            components={{ 1: <strong /> }}
          />
        </p>
      </>
    )
  }

  return (
    <>
      <h1>{t("Welcome to the new settlement system")}</h1>
      <Paragraph>
        {" "}
        {t("This is a MVP in beta. Only test users have access.")}
      </Paragraph>
      <h2>{t("Sign in")}</h2>
      <p>{t("Enter your email and we'll send you a sign-in link.")}</p>
      <form
        onSubmit={e => {
          void handleSubmit(e)
        }}
      >
        <input
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
      {errorMsg ? <p role="alert">{errorMsg}</p> : null}
    </>
  )
}
