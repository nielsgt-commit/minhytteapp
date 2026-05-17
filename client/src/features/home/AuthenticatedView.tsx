import { Button } from "@digdir/designsystemet-react"
import { logout } from "@/auth/oauth"

type AuthenticatedViewProps = {
  userName: string
}

export function AuthenticatedView({ userName }: AuthenticatedViewProps) {
  const handleLogout = () => {
    logout()
    window.location.replace("/")
  }

  return (
    <>
      <p>Signed in as <strong>{userName}</strong></p>
      <Button onClick={handleLogout}>Log out</Button>
    </>
  )
}
