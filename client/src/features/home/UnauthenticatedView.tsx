import { Button } from "@digdir/designsystemet-react"
import { startLogin } from "@/auth/oauth"

export function UnauthenticatedView() {
  const handleLogin = () => {
    startLogin()
  }

  return (
    <>
      <h3> Visible when user is not logged in</h3>
      <p> Log in or create account </p>
      <Button onClick={handleLogin}>Log in</Button>
    </>
  )
}
