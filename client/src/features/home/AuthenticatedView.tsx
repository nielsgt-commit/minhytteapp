import { Button } from "@digdir/designsystemet-react"
import { loadAuth } from "@/auth/oauth"
import { useLogoutAction } from "./useLogoutAction"

export function AuthenticatedView() {
  const auth = loadAuth()
  const userName = auth.user?.name ?? ""
  const handleLogout = useLogoutAction()

  return (
    <>
      <p>Signed in as <strong>{userName}</strong></p>
      <Button onClick={handleLogout}>Log out</Button>
    </>
  )
}
