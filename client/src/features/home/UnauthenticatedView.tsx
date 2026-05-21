import { useState } from "react"
import { Button, Paragraph } from "@digdir/designsystemet-react"
import { signIn } from "@/auth/auth-client"

export function UnauthenticatedView() {
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
      setErrorMsg(error.message ?? "Could not send magic link")
      return
    }
    setStatus("sent")
  }

  if (status === "sent") {
    return (
      <>
        <h2>Check your email</h2>
        <p>
          We sent a sign-in link to <strong>{email}</strong>. Click it to
          continue. (In dev, the link is printed to the API server console.)
        </p>
      </>
    )
  }

  return (
    <>
      <h1>Welcome to the new settlement system</h1>
      <Paragraph> This is a MVP in beta. Only test users have access.</Paragraph>
      <h2>Sign in</h2>
      <p>Enter your email and we&apos;ll send you a sign-in link.</p>
      <form onSubmit={e => { void handleSubmit(e) }}>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={e => { setEmail(e.target.value) }}
          disabled={status === "sending"}
        />
        <Button type="submit" disabled={status === "sending" || !email}>
          {status === "sending" ? "Sending…" : "Send magic link"}
        </Button>
      </form>
      {errorMsg ? <p role="alert">{errorMsg}</p> : null}
    </>
  )
}
