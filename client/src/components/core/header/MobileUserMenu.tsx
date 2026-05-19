import { useSelectedUserId } from "@/app/useSelectedIds"
import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Avatar, Divider, Dropdown, Tag } from "@digdir/designsystemet-react"
import { ChevronDownIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { useAppDispatch } from "@/app/hooks"
import { setSelectedUserId } from "@/features/user/userSlice"
import { loadAuth, logout } from "@/auth/oauth"
import CheckIn from "./CheckIn"
import ColorSchemeToggle from "./ColorSchemeToggle"

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? "")
    .join("")
}

export default function MobileUserMenu() {
  const { t } = useTranslation("core")
  const trpc = useTRPC()
  const auth = loadAuth()
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

  const list = me ? [me] : []

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
          g => g.is_main && g.members.some(m => m.user_id === selectedId),
        )
      : undefined

  const handleLogout = () => {
    logout()
    window.location.assign("/")
  }

  return (
    <Dropdown.TriggerContext>
      <Dropdown.Trigger
        variant="tertiary"
        data-color="neutral"
        aria-label={t("User menu")}
        style={isOpen ? undefined : { border: "none" }}
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
          onOpen={() => { setIsOpen(true) }}
          onClose={() => { setIsOpen(false) }}
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
          <div style={{ padding: "0.5rem 0.75rem" }}>
            <CheckIn />
          </div>
          <Divider />
          <div style={{ padding: "0.5rem 0.75rem" }}>
            <ColorSchemeToggle />
          </div>
          <Divider />
          <Dropdown.List>
            <Dropdown.Item>
              <Dropdown.Button onClick={() => { void navigate({ to: "/usersettings" }) }}>
                {t("Settings")}
              </Dropdown.Button>
            </Dropdown.Item>
            <Dropdown.Item>
              <Dropdown.Button data-color="danger" onClick={handleLogout}>
                {t("Log out")}
              </Dropdown.Button>
            </Dropdown.Item>
          </Dropdown.List>
        </Dropdown>
    </Dropdown.TriggerContext>
  )
}
