import { Children, useCallback, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { Pagination } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./CardGallery.module.css"
import { useIsMobile } from "@/hooks/useIsMobile.ts"

/**
 * Renders its children as a vertical stack on desktop and as a swipable
 * one-row gallery on mobile, with DigDir Pagination dots tracking and driving
 * the active card. Each direct child is treated as one gallery item.
 *
 * By default each item is sized to leave the next one peeking at the edge,
 * hinting that it scrolls. Pass `fullWidth` when each child is a whole page
 * (e.g. a swipable dashboard) so items fill the viewport with no peek.
 */
export function CardGallery({
  children,
  ariaLabel,
  fullWidth = false,
}: {
  children: ReactNode
  ariaLabel: string
  fullWidth?: boolean
}) {
  const { t } = useTranslation("maintenance")
  const isMobile = useIsMobile()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [pageHeight, setPageHeight] = useState<number>()
  const count = Children.count(children)

  // The active card is whichever sits closest to the viewport centre — robust
  // to the card width, gap and scroll padding without hardcoding any of them.
  const updateActive = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const viewportCenter = el.scrollLeft + el.clientWidth / 2
    let best = 0
    let bestDist = Infinity
    Array.from(el.children).forEach((child, i) => {
      const node = child as HTMLElement
      const center = node.offsetLeft + node.offsetWidth / 2
      const dist = Math.abs(center - viewportCenter)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    })
    setActive(best)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !isMobile) return
    updateActive()
    el.addEventListener("scroll", updateActive, { passive: true })
    return () => {
      el.removeEventListener("scroll", updateActive)
    }
  }, [isMobile, count, updateActive])

  // In page mode every page lives in one flex row, so the gallery is as tall as
  // the tallest page — leaving big empty space under shorter ones. Track the
  // active page's own height instead so the gallery shrinks to fit what's shown.
  // (Peek-card mode keeps cards side by side, where a shared height is fine.)
  useEffect(() => {
    if (!isMobile || !fullWidth) {
      setPageHeight(undefined)
      return
    }
    const child = scrollRef.current?.children[active] as HTMLElement | undefined
    if (!child) return
    const measure = () => {
      setPageHeight(child.offsetHeight)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(child)
    return () => {
      ro.disconnect()
    }
  }, [isMobile, fullWidth, active, count])

  const goTo = (i: number) => {
    const el = scrollRef.current
    if (!el || i < 0 || i >= count) return
    const child = el.children[i] as HTMLElement | undefined
    if (!child) return
    // Bounding-rect delta works regardless of the child's offsetParent; the
    // exact landing is then refined by scroll-snap.
    const delta =
      child.getBoundingClientRect().left - el.getBoundingClientRect().left
    el.scrollTo({ left: el.scrollLeft + delta, behavior: "smooth" })
  }

  return (
    <>
      <div
        className={`${styles.cards} ${fullWidth ? styles.fullWidth : ""}`}
        ref={scrollRef}
        style={
          isMobile && fullWidth && pageHeight != null
            ? { height: pageHeight }
            : undefined
        }
      >
        {children}
      </div>
      {isMobile && count > 1 && (
        // DigDir's Pagination injects a chevron onto the first and last list
        // items by design, so those slots are the prev/next arrows and the
        // page numbers (here: dots) sit in between.
        <Pagination
          aria-label={ariaLabel}
          className={`${styles.dots} ${fullWidth ? styles.floating : ""}`}
        >
          <Pagination.List>
            <Pagination.Item>
              <Pagination.Button
                className={styles.arrow}
                disabled={active === 0}
                onClick={() => {
                  goTo(active - 1)
                }}
              >
                <span className={styles.srOnly}>{t("Previous card")}</span>
              </Pagination.Button>
            </Pagination.Item>
            {Array.from({ length: count }).map((_, i) => (
              <Pagination.Item key={i}>
                <Pagination.Button
                  className={styles.dot}
                  aria-current={i === active ? "page" : undefined}
                  aria-label={t("Go to card {{number}}", { number: i + 1 })}
                  onClick={() => {
                    goTo(i)
                  }}
                >
                  <span className={styles.dotGlyph} aria-hidden />
                </Pagination.Button>
              </Pagination.Item>
            ))}
            <Pagination.Item>
              <Pagination.Button
                className={styles.arrow}
                disabled={active === count - 1}
                onClick={() => {
                  goTo(active + 1)
                }}
              >
                <span className={styles.srOnly}>{t("Next card")}</span>
              </Pagination.Button>
            </Pagination.Item>
          </Pagination.List>
        </Pagination>
      )}
    </>
  )
}
