import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Card, Heading } from "@digdir/designsystemet-react"
import { Link, useLocation, useRouter } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import styles from "./SideNav.module.css"

export type SideNavGroup = {
  label: string
  items: readonly { to: string; label: string }[]
}

type Props = {
  groups: readonly SideNavGroup[]
  ariaLabel?: string
}

export function SideNav({ groups, ariaLabel }: Props) {
  const { t } = useTranslation("shared")
  const { pathname } = useLocation()
  const router = useRouter()

  const flatItems = useMemo(() => groups.flatMap(g => g.items), [groups])
  const indexByTo = useMemo(() => {
    const m = new Map<string, number>()
    flatItems.forEach((item, i) => { m.set(item.to, i) })
    return m
  }, [flatItems])

  const activeIndex = flatItems.findIndex(
    item => pathname === item.to || pathname.startsWith(item.to + "/"),
  )

  const [focusedIndex, setFocusedIndex] = useState(
    activeIndex === -1 ? 0 : activeIndex,
  )

  useEffect(() => {
    if (activeIndex !== -1) setFocusedIndex(activeIndex)
  }, [activeIndex])

  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])

  const moveFocus = (next: number) => {
    const clamped = Math.max(0, Math.min(flatItems.length - 1, next))
    setFocusedIndex(clamped)
    itemRefs.current[clamped]?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      moveFocus(focusedIndex + 1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      moveFocus(focusedIndex - 1)
    } else if (e.key === "Home") {
      e.preventDefault()
      moveFocus(0)
    } else if (e.key === "End") {
      e.preventDefault()
      moveFocus(flatItems.length - 1)
    }
  }

  return (
    <Card asChild>
      <nav aria-label={ariaLabel ?? t("Sections")} onKeyDown={handleKeyDown}>
        {groups.map(group => (
          <Card.Block key={group.label}>
            <Heading level={2} data-size="xs">{group.label}</Heading>
            <ul className={styles.list}>
              {group.items.map(item => {
                const idx = indexByTo.get(item.to) ?? 0
                const active =
                  pathname === item.to || pathname.startsWith(item.to + "/")
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      preload="intent"
                      className={styles.link}
                      aria-current={active ? "page" : undefined}
                      tabIndex={idx === focusedIndex ? 0 : -1}
                      ref={el => { itemRefs.current[idx] = el }}
                      onFocus={() => {
                        setFocusedIndex(idx)
                        void router.preloadRoute({ to: item.to })
                      }}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Card.Block>
        ))}
      </nav>
    </Card>
  )
}
