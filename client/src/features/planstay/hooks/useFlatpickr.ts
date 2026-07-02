import { useEffect, useRef, useSyncExternalStore } from "react"
import type React from "react"
import flatpickr from "flatpickr"
import type { DayElement } from "flatpickr/dist/types/instance"
import { Norwegian } from "flatpickr/dist/l10n/no.js"
import "flatpickr/dist/flatpickr.min.css"
import "../flatpickr-digdir.css"
import { useTranslation } from "react-i18next"
import { Temporal } from "temporal-polyfill"
import { BOOKING_MIN, BOOKING_MAX } from "../constants"
import { setDates } from "@/features/planstay/booking-logic"
import type {
  BookingDraft,
  BookingDraftAction,
} from "@/features/planstay/booking-logic"
import { groupColor } from "@/features/usergroups/groupColors"

const WIDE_QUERY = "(min-width: 640px)"

// Up to this many people render as individual dots; 5+ collapse into a single
// rounded bar segmented by family group.
const MAX_DOTS = 4

// flatpickr only speaks `Date` — convert at this boundary. A picker `Date`
// is a local wall-clock day, so read its local calendar fields.
function pickerDateToPlainDate(d: Date): Temporal.PlainDate {
  return Temporal.PlainDate.from({
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  })
}

function subscribeWide(callback: () => void) {
  const mq = window.matchMedia(WIDE_QUERY)
  mq.addEventListener("change", callback)
  return () => {
    mq.removeEventListener("change", callback)
  }
}

function getShowMonthsSnapshot() {
  return window.matchMedia(WIDE_QUERY).matches ? 2 : 1
}

export function useFlatpickr(
  draft: Pick<BookingDraft, "start_date" | "end_date">,
  dispatch: React.Dispatch<BookingDraftAction>,
  // ISO date ("YYYY-MM-DD") → family-group id per person staying that night.
  // One entry per occupant; same person twice if two of their nights overlap.
  dotsByDay?: Map<string, number[]>,
) {
  const inputRef = useRef<HTMLInputElement>(null)
  const fpRef = useRef<{
    destroy: () => void
    clear: () => void
    redraw: () => void
  } | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const guestInputRef = useRef<HTMLInputElement>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft
  // Read inside onDayCreate via ref so dot data can change without tearing down
  // and rebuilding the whole flatpickr instance.
  const dotsRef = useRef(dotsByDay)
  dotsRef.current = dotsByDay

  const showMonths = useSyncExternalStore(subscribeWide, getShowMonthsSnapshot)
  const { t, i18n } = useTranslation("planstay")
  const language = i18n.resolvedLanguage
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    if (!inputRef.current) return
    let ro: ResizeObserver | null = null
    const fp = flatpickr(inputRef.current, {
      mode: "range",
      inline: true,
      showMonths,
      locale: language === "nb" ? Norwegian : "default",
      minDate: BOOKING_MIN,
      maxDate: BOOKING_MAX,
      defaultDate: [
        draftRef.current.start_date,
        draftRef.current.end_date,
      ].filter((d): d is string => d != null),
      onChange(selectedDates) {
        // The reducer stays string-keyed — dispatch ISO strings.
        if (selectedDates.length === 2) {
          dispatch(
            setDates(
              pickerDateToPlainDate(selectedDates[0]).toString(),
              pickerDateToPlainDate(selectedDates[1]).toString(),
            ),
          )
        } else if (selectedDates.length === 1) {
          const s = pickerDateToPlainDate(selectedDates[0]).toString()
          dispatch(setDates(s, s))
        }
      },
      onDayCreate(_dates, _str, _instance, dayElem: DayElement) {
        const iso = pickerDateToPlainDate(dayElem.dateObj).toString()
        const groups = dotsRef.current?.get(iso)
        if (!groups || groups.length === 0) return
        // Cluster same-family dots together for an at-a-glance read.
        const sorted = [...groups].sort((a, b) => a - b)
        const wrap = document.createElement("span")
        wrap.className = "fp-occupant-dots"
        wrap.title = tRef.current("{{count}} staying", { count: groups.length })
        // gid 0 = occupant with no family group → neutral.
        const colorFor = (gid: number) =>
          gid > 0 ? groupColor(gid) : "var(--ds-color-neutral-base-default)"

        if (sorted.length <= MAX_DOTS) {
          for (const gid of sorted) {
            const dot = document.createElement("span")
            dot.className = "fp-occupant-dot"
            dot.style.backgroundColor = colorFor(gid)
            wrap.appendChild(dot)
          }
        } else {
          // 5+ people: one rounded bar, segmented by family group with each
          // segment sized to that group's headcount. `sorted` is ascending, so
          // equal ids are already adjacent.
          const bar = document.createElement("span")
          bar.className = "fp-occupant-bar"
          for (let i = 0; i < sorted.length; ) {
            const gid = sorted[i]
            let n = 0
            while (i < sorted.length && sorted[i] === gid) {
              n++
              i++
            }
            const seg = document.createElement("span")
            seg.className = "fp-occupant-bar-seg"
            seg.style.backgroundColor = colorFor(gid)
            seg.style.flexGrow = String(n)
            bar.appendChild(seg)
          }
          wrap.appendChild(bar)
        }
        dayElem.appendChild(wrap)
      },
      onReady(_dates, _str, instance) {
        ro = new ResizeObserver(() => {
          const h = instance.calendarContainer.offsetHeight
          if (h > 0)
            rowRef.current?.style.setProperty("--fp-height", `${String(h)}px`)
        })
        ro.observe(instance.calendarContainer)
      },
    })
    // flatpickr(Element, …) always returns a single Instance, not an array
    fpRef.current = fp as unknown as {
      destroy: () => void
      clear: () => void
      redraw: () => void
    }
    return () => {
      ro?.disconnect()
      fpRef.current?.destroy()
    }
  }, [showMonths, dispatch, language])

  // Re-run onDayCreate when the occupant dots change (e.g. after a stay is
  // saved) without rebuilding the calendar.
  useEffect(() => {
    fpRef.current?.redraw()
  }, [dotsByDay])

  useEffect(() => {
    if (draft.start_date == null && draft.end_date == null) {
      fpRef.current?.clear()
    }
  }, [draft.start_date, draft.end_date])

  return { inputRef, rowRef, guestInputRef }
}
