import { logout } from "@/auth/oauth"

export function useLogoutAction() {
  return () => {
    logout()
    window.location.replace("/")
  }
}
