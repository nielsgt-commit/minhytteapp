import { startLogin } from "@/auth/oauth"

export function useLoginAction() {
  return () => {
    startLogin()
  }
}
