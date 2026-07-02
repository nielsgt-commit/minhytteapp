import { useEffect, useRef } from "react"
import type React from "react"
import flatpickr from "flatpickr"
import type { DayElement, Instance } from "flatpickr/dist/types/instance"
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

// Sibling of `useFlatpickr` for the PlanStayFlowSheet layout: instead of one
// inline range calendar, this drives TWO single-date popup calendars (a start
// field and an end field). The original range hook is deliberately left
// untouched — this is a parallel implementation.

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

type FpHandle = Pick<Instance, "destroy" | "clear" | "redraw" | "setDate">

// Renders the per-day occupant dots (same look as the range calendar) into a
// freshly created day cell. Reads dot data via the supplied getter so the data
// can change without tearing down the instance.
function paintOccupantDots(
  dayElem: DayElement,
  getDots: () => Map<string, number[]> | undefined,
  t: (key: string, opts: { count: number }) => string,
) {
  const iso = pickerDateToPlainDate(dayElem.dateObj).toString()
  const groups = getDots()?.get(iso)
  if (!groups || groups.length === 0) return
  const sorted = [...groups].sort((a, b) => a - b)
  const wrap = document.createElement("span")
  wrap.className = "fp-occupant-dots"
  wrap.title = t("{{count}} staying", { count: groups.length })
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
}

export function useSingleDateFlatpickr(
  draft: Pick<BookingDraft, "start_date" | "end_date">,
  dispatch: React.Dispatch<BookingDraftAction>,
  // ISO date ("YYYY-MM-DD") → family-group id per person staying that night.
  dotsByDay?: Map<string, number[]>,
) {
  const startInputRef = useRef<HTMLInputElement>(null)
  const endInputRef = useRef<HTMLInputElement>(null)
  const startFpRef = useRef<FpHandle | null>(null)
  const endFpRef = useRef<FpHandle | null>(null)

  // Read the latest draft inside onChange via a ref so picking one end can
  // clamp against the other without rebuilding the instances.
  const draftRef = useRef(draft)
  draftRef.current = draft
  const dotsRef = useRef(dotsByDay)
  dotsRef.current = dotsByDay

  const { t, i18n } = useTranslation("planstay")
  const language = i18n.resolvedLanguage
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    if (!startInputRef.current || !endInputRef.current) return

    const locale = language === "nb" ? Norwegian : "default"
    const onDayCreate = (
      _dates: Date[],
      _str: string,
      _instance: Instance,
      dayElem: DayElement,
    ) => {
      paintOccupantDots(dayElem, () => dotsRef.current, tRef.current)
    }

    const startFp = flatpickr(startInputRef.current, {
      mode: "single",
      locale,
      // The sheet is a native modal <dialog> (top layer). Without `static`,
      // flatpickr appends its calendar to <body>, where it renders behind the
      // dialog and is unclickable. `static` keeps it inline under the input.
      static: true,
      // On touch devices flatpickr defaults to swapping in the OS-native date
      // input, which on iOS is a single-date wheel that ignores our season
      // bounds, occupant dots, and start/end clamping. Force our own calendar
      // so mobile matches desktop (the whole point of this hook).
      disableMobile: true,
      // Leave the input typeable so flatpickr does NOT set a `readonly`
      // attribute — digdir paints a lock icon on any field that has one
      // (`.ds-field:has([readonly]) label`), regardless of the React prop.
      allowInput: true,
      minDate: BOOKING_MIN,
      maxDate: BOOKING_MAX,
      defaultDate: draftRef.current.start_date ?? undefined,
      onDayCreate,
      onChange(selectedDates) {
        if (selectedDates.length !== 1) return
        const start = pickerDateToPlainDate(selectedDates[0]).toString()
        // Keep the range valid: clamp the end up to the new start if needed.
        const cur = draftRef.current
        const end =
          cur.end_date != null && cur.end_date >= start ? cur.end_date : start
        dispatch(setDates(start, end))
      },
    }) as unknown as FpHandle

    const endFp = flatpickr(endInputRef.current, {
      mode: "single",
      locale,
      static: true,
      disableMobile: true,
      allowInput: true,
      minDate: BOOKING_MIN,
      maxDate: BOOKING_MAX,
      defaultDate: draftRef.current.end_date ?? undefined,
      onDayCreate,
      onChange(selectedDates) {
        if (selectedDates.length !== 1) return
        const end = pickerDateToPlainDate(selectedDates[0]).toString()
        // Clamp the start down to the new end if the user picked an earlier end.
        const cur = draftRef.current
        const start =
          cur.start_date != null && cur.start_date <= end ? cur.start_date : end
        dispatch(setDates(start, end))
      },
    }) as unknown as FpHandle

    startFpRef.current = startFp
    endFpRef.current = endFp
    return () => {
      startFp.destroy()
      endFp.destroy()
      startFpRef.current = null
      endFpRef.current = null
    }
  }, [dispatch, language])

  // Re-run onDayCreate when occupant dots change, without rebuilding.
  useEffect(() => {
    startFpRef.current?.redraw()
    endFpRef.current?.redraw()
  }, [dotsByDay])

  // Keep each input in sync when the draft changes elsewhere (e.g. RESET after
  // a save clears both). `setDate(_, false)` updates without re-firing onChange.
  useEffect(() => {
    const fp = startFpRef.current
    if (!fp) return
    if (draft.start_date == null) fp.clear()
    else fp.setDate(draft.start_date, false)
  }, [draft.start_date])

  useEffect(() => {
    const fp = endFpRef.current
    if (!fp) return
    if (draft.end_date == null) fp.clear()
    else fp.setDate(draft.end_date, false)
  }, [draft.end_date])

  return { startInputRef, endInputRef }
}
