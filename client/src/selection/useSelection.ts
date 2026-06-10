import { useCallback } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"

// The app Header renders under __root (outside _authed), so these read hooks
// use `strict: false` to work from any route match.
export function useSelectedPropertyId(): number | null {
  const search = useSearch({ strict: false })
  return search.property ?? null
}

export function useSelectedUserId(): number | null {
  const search = useSearch({ strict: false })
  return search.user ?? null
}

type SetOpts = { replace?: boolean }

export function useSetSelectedPropertyId() {
  const navigate = useNavigate()
  return useCallback(
    (id: number | null, opts?: SetOpts) =>
      navigate({
        to: ".",
        search: prev => ({ ...prev, property: id ?? undefined }),
        replace: opts?.replace ?? false,
      }),
    [navigate],
  )
}

export function useSetSelectedUserId() {
  const navigate = useNavigate()
  return useCallback(
    (id: number | null, opts?: SetOpts) =>
      navigate({
        to: ".",
        search: prev => ({ ...prev, user: id ?? undefined }),
        replace: opts?.replace ?? false,
      }),
    [navigate],
  )
}
