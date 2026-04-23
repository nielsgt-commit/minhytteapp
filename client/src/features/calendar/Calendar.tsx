import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import styles from "./Calendar.module.css"
import { useTRPC } from "@/trpc/trpc"

export function Calendar() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { data: bookings } = useSuspenseQuery(trpc.booking.list.queryOptions())
  const createBooking = useMutation(
    trpc.booking.create.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.booking.list.queryKey() })
      },
    }),
  )

  const handleAddDemo = () => {
    const start = new Date()
    start.setDate(start.getDate() + 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 3)
    createBooking.mutate({
      property_id: 1,
      booker_id: 1,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
    })
  }

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Calendar</h2>
      <div className={styles.content}>
        <ul>
          {bookings.map(b => (
            <li key={b.id}>
              {b.start_date} → {b.end_date} — {b.booker_name ?? `user #${b.booker_id}`}
            </li>
          ))}
        </ul>
        <button onClick={handleAddDemo} disabled={createBooking.isPending}>
          {createBooking.isPending ? "Booking…" : "Add demo booking"}
        </button>
      </div>
    </section>
  )
}