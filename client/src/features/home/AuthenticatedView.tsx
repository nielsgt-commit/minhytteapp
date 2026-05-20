import { Button } from "@digdir/designsystemet-react"
import { useAuthSession } from "@/auth/auth-client"
import { useLogoutAction } from "./useLogoutAction"

export function AuthenticatedView() {
  const auth = useAuthSession()
  const userName = auth.user?.name ?? ""
  const handleLogout = useLogoutAction()

  return (
    <>
      <p>Signed in as <strong>{userName}</strong></p>
      <Button onClick={() => { void handleLogout() }}>Log out</Button>
    </>
  )
}
