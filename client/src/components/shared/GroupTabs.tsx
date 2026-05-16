import { Chip, Tabs } from "@digdir/designsystemet-react"
import { useLocation, useNavigate, useRouter } from "@tanstack/react-router"
import type { SideNavGroup } from "./SideNav"
import styles from "./GroupTabs.module.css"

const NONE_VALUE = "__none__"

type Props = {
  groups: readonly SideNavGroup[]
}

export function GroupTabs({ groups }: Props) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const router = useRouter()

  const activeGroupIdx = groups.findIndex(g =>
    g.items.some(i => pathname === i.to || pathname.startsWith(i.to + "/")),
  )
  const activeValue =
    activeGroupIdx === -1
      ? NONE_VALUE
      : (groups[activeGroupIdx]?.label ?? NONE_VALUE)

  const handleTabChange = (newLabel: string) => {
    if (newLabel === NONE_VALUE) return
    const newGroup = groups.find(g => g.label === newLabel)
    const firstItem = newGroup?.items[0]
    if (firstItem) void navigate({ to: firstItem.to })
  }

  return (
    <Tabs value={activeValue} onChange={handleTabChange}>
      <Tabs.List>
        <Tabs.Tab value={NONE_VALUE} hidden style={{ display: "none" }} aria-hidden />
        {groups.map(g => (
          <Tabs.Tab key={g.label} value={g.label}>{g.label}</Tabs.Tab>
        ))}
      </Tabs.List>
      {groups.map(g => {
        const radioName = `section-${g.label.toLowerCase()}`
        return (
          <Tabs.Panel key={g.label} value={g.label}>
            {g.items.length > 1 && (
              <div
                className={styles.filter}
                role="group"
                aria-label={`${g.label} sections`}
              >
                {g.items.map(i => {
                  const active =
                    pathname === i.to || pathname.startsWith(i.to + "/")
                  return (
                    <Chip.Radio
                      key={i.to}
                      name={radioName}
                      value={i.to}
                      checked={active}
                      onChange={() => { void navigate({ to: i.to }) }}
                      onFocus={() => { void router.preloadRoute({ to: i.to }) }}
                    >
                      {i.label}
                    </Chip.Radio>
                  )
                })}
              </div>
            )}
          </Tabs.Panel>
        )
      })}
    </Tabs>
  )
}
