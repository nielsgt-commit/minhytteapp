import { Button } from "@digdir/designsystemet-react"
import { useLoginAction } from "./useLoginAction"

export function UnauthenticatedView() {
  const handleLogin = useLoginAction()

  return (
    <>
      <h2> Visible when user is not logged in</h2>
      <p> Log in or create account </p>
      <Button onClick={handleLogin}>Log in</Button>
    </>
  )
}
