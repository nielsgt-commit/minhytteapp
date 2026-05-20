import { signOut } from "@/auth/auth-client"

export function useLogoutAction() {
  return async () => {
    await signOut()
    window.location.replace("/")
  }
}
