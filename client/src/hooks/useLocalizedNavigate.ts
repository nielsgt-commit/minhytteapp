import { useRouter } from "@tanstack/react-router"
import i18next from "i18next"
import { toCanonicalPath, toPublicPath } from "@/i18n/localizedPaths"

export function useSwitchLocale() {
  const router = useRouter()

  return (targetLocale: "en" | "nb") => {
    void i18next.changeLanguage(targetLocale).then(() => {
      // Re-render the address bar in the new language. Done through the
      // history instance directly: a plain navigate to the unchanged
      // internal location gets deduped by the router (only the display
      // language changed), leaving the URL stuck in the previous language.
      // toCanonicalPath first so this works whether the router hands us the
      // internal (NB) or public pathname.
      const { pathname, searchStr, hash } = router.state.location
      const publicPath = toPublicPath(toCanonicalPath(pathname), targetLocale)
      router.history.replace(publicPath + searchStr + (hash ? `#${hash}` : ""))
    })
  }
}
