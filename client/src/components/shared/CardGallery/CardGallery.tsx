import {
  Children,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import type { ReactNode, TouchEvent } from "react"
import { Pagination } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./CardGallery.module.css"
import { useIsMobile } from "@/hooks/useIsMobile.ts"

// Snap tuning. Speeds are px/ms (a relaxed swipe is ~0.3–0.8, a sharp flick
// >1.5). Above FLICK_SPEED a release pages in the flick's direction regardless
// of distance; above MIN_SNAP_SPEED the snap duration tracks that speed so the
// page coasts to rest instead of using a fixed time, clamped to [MIN,MAX]_SNAP.
// TAP_SNAP_MS is the fixed ease for dots/arrows and near-still releases.
const FLICK_SPEED = 0.5
const MIN_SNAP_SPEED = 0.05
const MIN_SNAP_MS = 120
const MAX_SNAP_MS = 400
const TAP_SNAP_MS = 250

/**
 * Renders its children as a vertical stack on desktop and as a swipable
 * one-row gallery on mobile, with DigDir Pagination dots tracking and driving
 * the active card. Each direct child is treated as one gallery item.
 *
 * By default each item is sized to leave the next one peeking at the edge,
 * hinting that it scrolls. Pass `fullWidth` when each child is a whole page
 * (e.g. a swipable dashboard) so items fill the viewport with no peek.
 *
 * Paging is transform-based, not native scroll: a drag follows the finger but
 * is clamped to a single page, and releasing snaps to at most one neighbour.
 * This guarantees one page per swipe — a fast flick can never coast past the
 * next page the way native `scroll-snap` momentum can.
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
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [pageHeight, setPageHeight] = useState<number>()
  const count = Children.count(children)

  // Drag bookkeeping. The first move locks an axis so vertical page scrolling is
  // never hijacked by the horizontal pager.
  const dragStartX = useRef<number | null>(null)
  const dragStartY = useRef(0)
  const dragBase = useRef(0)
  const dragAxis = useRef<"x" | "y" | undefined>(undefined)
  // Live translate during a drag, and a small velocity sampler (px/ms, signed —
  // negative is leftward) used to make the release snap match the flick speed.
  const dragTranslate = useRef(0)
  const lastMoveX = useRef(0)
  const lastMoveT = useRef(0)
  const velocity = useRef(0)
  // Duration (ms) the next active-driven transform should animate over. Mount,
  // resize and item-count changes re-park instantly (0); user-driven page
  // changes set this first — a fixed ease for dots/arrows, a velocity-derived
  // time for swipes — so the snap continues the gesture's own momentum.
  const nextTransitionMs = useRef(0)

  // Pixel offset that brings page `i` to rest, derived from the children's own
  // layout so it works for both peek (partial width + gap) and full-width pages
  // without hardcoding widths, gaps or padding. Page 0 sits at translate 0.
  const translateForIndex = useCallback((i: number) => {
    const el = trackRef.current
    if (!el) return 0
    const first = el.children[0] as HTMLElement | undefined
    const target = el.children[i] as HTMLElement | undefined
    if (!first || !target) return 0
    return -(target.offsetLeft - first.offsetLeft)
  }, [])

  // durationMs of 0 parks instantly (used mid-drag and for layout re-parks).
  const applyTransform = useCallback((px: number, durationMs: number) => {
    const el = trackRef.current
    if (!el) return
    el.style.transition =
      durationMs > 0 ? `transform ${String(durationMs)}ms ease-out` : "none"
    el.style.transform = `translate3d(${String(px)}px, 0, 0)`
  }, [])

  // Keep the track parked on the active page. Re-runs when the page or item
  // count changes, and on resize, so the rest position tracks the live layout.
  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    if (!isMobile) {
      el.style.transition = ""
      el.style.transform = ""
      nextTransitionMs.current = 0
      return
    }
    applyTransform(translateForIndex(active), nextTransitionMs.current)
    nextTransitionMs.current = 0
    const onResize = () => {
      applyTransform(translateForIndex(active), 0)
    }
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
    }
  }, [isMobile, active, count, applyTransform, translateForIndex])

  // In page mode every page lives in one flex row, so the gallery is as tall as
  // the tallest page — leaving big empty space under shorter ones. Track the
  // active page's own height instead so the gallery shrinks to fit what's shown.
  // (Peek-card mode keeps cards side by side, where a shared height is fine.)
  useEffect(() => {
    if (!isMobile || !fullWidth) {
      setPageHeight(undefined)
      return
    }
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const child = el.children[active] as HTMLElement | undefined
      if (child) setPageHeight(child.offsetHeight)
    })
    // (Re)attach the size observer to whichever node is currently the active
    // page, and measure it. A page whose root is a Suspense boundary (e.g. the
    // Now page) replaces its fallback DOM node with the resolved content once
    // its query loads; without re-observing, the gallery height would stay
    // stuck at the small fallback's height and clip the real card.
    const attach = () => {
      ro.disconnect()
      const child = el.children[active] as HTMLElement | undefined
      if (!child) return
      setPageHeight(child.offsetHeight)
      ro.observe(child)
    }
    attach()
    const mo = new MutationObserver(attach)
    mo.observe(el, { childList: true })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [isMobile, fullWidth, active, count])

  // Jump to an arbitrary page (dots/arrows). The layout effect performs the
  // eased move once `active` changes.
  const goTo = (i: number) => {
    if (i < 0 || i >= count || i === active) return
    nextTransitionMs.current = TAP_SNAP_MS
    setActive(i)
  }

  const onTouchStart = (e: TouchEvent) => {
    if (!isMobile) return
    dragStartX.current = e.touches[0].clientX
    dragStartY.current = e.touches[0].clientY
    dragBase.current = translateForIndex(active)
    dragTranslate.current = dragBase.current
    dragAxis.current = undefined
    lastMoveX.current = e.touches[0].clientX
    lastMoveT.current = e.timeStamp
    velocity.current = 0
  }

  const onTouchMove = (e: TouchEvent) => {
    if (dragStartX.current == null) return
    const x = e.touches[0].clientX
    const dx = x - dragStartX.current
    const dy = e.touches[0].clientY - dragStartY.current

    // Lock the gesture to one axis on the first decisive movement. A vertical
    // gesture releases the drag so the page scrolls normally.
    if (dragAxis.current == null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      dragAxis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y"
      if (dragAxis.current === "y") {
        dragStartX.current = null
        return
      }
    }
    if (dragAxis.current !== "x") return

    // Sample instantaneous velocity from the last move, for the release snap.
    const dt = e.timeStamp - lastMoveT.current
    if (dt > 0) velocity.current = (x - lastMoveX.current) / dt
    lastMoveX.current = x
    lastMoveT.current = e.timeStamp

    // Clamp the drag to at most one page in either direction so no more than the
    // current page and one neighbour are ever in view mid-swipe.
    const toNext =
      active < count - 1
        ? translateForIndex(active + 1) - translateForIndex(active)
        : 0
    const toPrev =
      active > 0 ? translateForIndex(active - 1) - translateForIndex(active) : 0
    const clamped = Math.min(toPrev, Math.max(toNext, dx))
    dragTranslate.current = dragBase.current + clamped
    applyTransform(dragTranslate.current, 0)
  }

  const onTouchEnd = (e: TouchEvent) => {
    const startX = dragStartX.current
    dragStartX.current = null
    if (startX == null || dragAxis.current !== "x") return
    const dx = e.changedTouches[0].clientX - startX
    const speed = Math.abs(velocity.current)

    // A fast flick pages in its own direction even if the finger barely moved;
    // a slow drag must instead pass a fifth of the viewport to commit.
    const vw = viewportRef.current?.clientWidth ?? 1
    const dir =
      speed > FLICK_SPEED
        ? velocity.current < 0
          ? 1
          : -1
        : dx <= -vw * 0.2
          ? 1
          : dx >= vw * 0.2
            ? -1
            : 0
    const target = Math.max(0, Math.min(count - 1, active + dir))

    // Time the snap so the page keeps travelling at the finger's release speed,
    // clamped to a sane range; a near-still release uses the default ease.
    const targetPx = translateForIndex(target)
    const distance = Math.abs(targetPx - dragTranslate.current)
    const duration =
      speed > MIN_SNAP_SPEED
        ? Math.max(MIN_SNAP_MS, Math.min(MAX_SNAP_MS, distance / speed))
        : TAP_SNAP_MS

    if (target === active) {
      applyTransform(targetPx, duration)
    } else {
      nextTransitionMs.current = duration
      setActive(target)
    }
  }

  return (
    <>
      <div
        className={`${styles.viewport} ${fullWidth ? styles.fullWidth : ""}`}
        ref={viewportRef}
        style={
          isMobile && fullWidth && pageHeight != null
            ? { height: pageHeight }
            : undefined
        }
      >
        <div
          className={styles.track}
          ref={trackRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {children}
        </div>
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
