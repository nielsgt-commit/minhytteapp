import { useEffect, useRef, useState } from "react"
import type React from "react"
import flatpickr from "flatpickr"
import "flatpickr/dist/flatpickr.min.css"
import "../flatpickr-digdir.css"
import { SEASON_MIN, SEASON_MAX } from "../constants"
import { setDates, toIso } from "@/features/calendar/booking-logic"
import type { BookingDraft, BookingDraftAction } from "@/features/calendar/booking-logic"

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

  const [showMonths, setShowMonths] = useState(() => window.innerWidth >= 640 ? 2 : 1)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)")
    const handler = (e: MediaQueryListEvent) => { setShowMonths(e.matches ? 2 : 1) }
    mq.addEventListener("change", handler)
    return () => { mq.removeEventListener("change", handler) }
  }, [])

  useEffect(() => {
    if (!inputRef.current) return
    const fp = flatpickr(inputRef.current, {
      mode: "range",
      inline: true,
      showMonths,
      minDate: SEASON_MIN,
      maxDate: SEASON_MAX,
      defaultDate: [draftRef.current.start_date, draftRef.current.end_date].filter(
        (d): d is string => d != null,
      ),
      onChange(selectedDates) {
        if (selectedDates.length === 2) {
          dispatch(setDates(toIso(selectedDates[0]!), toIso(selectedDates[1]!)))
        } else if (selectedDates.length === 1) {
          const s = toIso(selectedDates[0]!)
          dispatch(setDates(s, s))
        }
      },
      onReady(_dates, _str, instance) {
        const h = instance.calendarContainer.offsetHeight
        if (h > 0) rowRef.current?.style.setProperty("--fp-height", `${String(h)}px`)
      },
    })
    // flatpickr(Element, …) always returns a single Instance, not an array
    fpRef.current = fp as unknown as { destroy: () => void; clear: () => void }
    return () => { fpRef.current?.destroy() }
  }, [showMonths, dispatch])

  useEffect(() => {
    if (draft.start_date == null && draft.end_date == null) {
      fpRef.current?.clear()
    }
  }, [draft.start_date, draft.end_date])

  return { inputRef, rowRef, guestInputRef }
}
