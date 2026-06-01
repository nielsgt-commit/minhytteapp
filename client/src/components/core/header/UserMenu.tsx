import { useSelectedUserId } from "@/features/user/userSlice"
import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Avatar, Divider, Dropdown, Tag } from "@digdir/designsystemet-react"
import { ChevronDownIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { useAppDispatch } from "@/app/hooks"
import { setSelectedUserId } from "@/features/user/userSlice"
import { signOut, useAuthSession } from "@/auth/auth-client"
import CheckIn from "./CheckIn"
import ColorSchemeToggle from "./ColorSchemeToggle"
import LanguageSwitcher from "./LanguageSwitcher"

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join("")
}

type Props = {
  showCheckIn?: boolean
}

export default function UserMenu({ showCheckIn = true }: Props) {
  const { t } = useTranslation("core")
  const trpc = useTRPC()
  const auth = useAuthSession()
  const { data: me } = useQuery(
    trpc.user.me.queryOptions(undefined, { enabled: auth.isAuthenticated }),
  )
  const { data: groups } = useQuery(
    trpc.userGroup.listWithMembers.queryOptions(),
  )
  const selectedId = useSelectedUserId()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  const list = useMemo(
    () => (me ? [{ ...me, name: me.name || me.email }] : []),
    [me],
  )

  useEffect(() => {
    if (list.length === 0) return
    const stillExists = list.some(u => u.id === selectedId)
    if (!stillExists) {
      dispatch(setSelectedUserId(list[0].id))
    }
  }, [list, selectedId, dispatch])

  if (!auth.user) return null

  const current = list.find(u => u.id === selectedId)
  const name = current?.name ?? t("Select user")

  const mainGroup =
    selectedId != null && groups
      ? groups.find(
          g => g.is_family && g.members.some(m => m.user_id === selectedId),
        )
      : undefined

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    setLogoutError(null)
    try {
      // better-auth's client resolves with { error } on HTTP/network
      // failure rather than throwing, so we must inspect it. Redirecting
      // unconditionally (the old behaviour) made a failed sign-out look
      // like a successful one — the cookie was never cleared, so the next
      // page load showed the user still logged in.
      const { error } = await signOut()
      if (error) {
        setLogoutError(error.message ?? t("Could not log out. Please try again."))
        setIsLoggingOut(false)
        return
      }
      // Full reload so all in-memory and React Query state is dropped and
      // the cleared session cookie takes effect on the next request.
      window.location.assign("/")
    } catch (e) {
      setLogoutError(
        e instanceof Error
          ? e.message
          : t("Could not log out. Please try again."),
      )
      setIsLoggingOut(false)
    }
  }

  return (
    <Dropdown.TriggerContext>
      <Dropdown.Trigger
        variant="tertiary"
        data-color="neutral"
        aria-label={t("User menu")}
        style={
          isOpen ? undefined : { border: "none", background: "transparent" }
        }
      >
        {name}
        {isOpen && <ChevronDownIcon aria-hidden />}
        <Avatar
          aria-hidden
          data-color="accent"
          data-initials={initials(name)}
          style={{ marginLeft: "auto" }}
        />
      </Dropdown.Trigger>
      <Dropdown
        placement="bottom-end"
        open={isOpen}
        onOpen={() => {
          setIsOpen(true)
        }}
        onClose={() => {
          setIsOpen(false)
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 0.75rem",
          }}
        >
          <span>{name}</span>
          {mainGroup && <Tag data-color="info">{mainGroup.name}</Tag>}
        </div>
        <Divider />
        {showCheckIn && (
          <>
            <div style={{ padding: "0.5rem 0.75rem" }}>
              <CheckIn />
            </div>
            <Divider />
          </>
        )}
        <div style={{ padding: "0.5rem 0.75rem" }}>
          <ColorSchemeToggle />
        </div>
        <Divider />
        <div style={{ padding: "0.5rem 0.75rem" }}>
          <LanguageSwitcher />
        </div>
        <Divider />
        <Dropdown.List>
          <Dropdown.Item>
            <Dropdown.Button
              onClick={() => {
                void navigate({ to: "/innstillinger" })
              }}
            >
              {t("Settings")}
            </Dropdown.Button>
          </Dropdown.Item>
          <Dropdown.Item>
            <Dropdown.Button
              data-color="danger"
              disabled={isLoggingOut}
              onClick={() => {
                void handleLogout()
              }}
            >
              {isLoggingOut ? t("Logging out…") : t("Log out")}
            </Dropdown.Button>
          </Dropdown.Item>
          {logoutError && (
            <Dropdown.Item>
              <p role="alert" data-color="danger">
                {t("Error: {{message}}", { message: logoutError })}
              </p>
            </Dropdown.Item>
          )}
        </Dropdown.List>
      </Dropdown>
    </Dropdown.TriggerContext>
  )
}
