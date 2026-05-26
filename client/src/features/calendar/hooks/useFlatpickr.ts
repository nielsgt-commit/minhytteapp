import { useEffect, useRef, useSyncExternalStore } from "react"
import type React from "react"
import flatpickr from "flatpickr"
import { Norwegian } from "flatpickr/dist/l10n/no.js"
import "flatpickr/dist/flatpickr.min.css"
import "../flatpickr-digdir.css"
import { useTranslation } from "react-i18next"
import { SEASON_MIN, SEASON_MAX } from "../constants"
import { setDates, toIso } from "@/features/calendar/booking-logic"
import type {
  BookingDraft,
  BookingDraftAction,
} from "@/features/calendar/booking-logic"

const WIDE_QUERY = "(min-width: 640px)"

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
) {
  const inputRef = useRef<HTMLInputElement>(null)
  const fpRef = useRef<{ destroy: () => void; clear: () => void } | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const guestInputRef = useRef<HTMLInputElement>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft

  const showMonths = useSyncExternalStore(subscribeWide, getShowMonthsSnapshot)
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage

  useEffect(() => {
    if (!inputRef.current) return
    let ro: ResizeObserver | null = null
    const fp = flatpickr(inputRef.current, {
      mode: "range",
      inline: true,
      showMonths,
      locale: language === "nb" ? Norwegian : "default",
      minDate: SEASON_MIN,
      maxDate: SEASON_MAX,
      defaultDate: [
        draftRef.current.start_date,
        draftRef.current.end_date,
      ].filter((d): d is string => d != null),
      onChange(selectedDates) {
        if (selectedDates.length === 2) {
          dispatch(setDates(toIso(selectedDates[0]), toIso(selectedDates[1])))
        } else if (selectedDates.length === 1) {
          const s = toIso(selectedDates[0])
          dispatch(setDates(s, s))
        }
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
    fpRef.current = fp as unknown as { destroy: () => void; clear: () => void }
    return () => {
      ro?.disconnect()
      fpRef.current?.destroy()
    }
  }, [showMonths, dispatch, language])

  useEffect(() => {
    if (draft.start_date == null && draft.end_date == null) {
      fpRef.current?.clear()
    }
  }, [draft.start_date, draft.end_date])

  return { inputRef, rowRef, guestInputRef }
}
