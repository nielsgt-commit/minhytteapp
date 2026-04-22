import styles from "./Calendar.module.css"
import { useBookings } from "./api/queries"
import { useCreateBooking } from "./api/mutations"

export function Calendar() {
  const { data: bookings = [], isPending } = useBookings()
  const createBooking = useCreateBooking()

  const handleAddDemo = () => {
    const start = new Date()
    start.setDate(start.getDate() + 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 3)
    createBooking.mutate({
      userId: "u_anna",
      userName: "Anna",
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      note: "Weekend trip",
    })
  }

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Calendar</h2>
      <div className={styles.content}>
        {isPending ? (
          <p>Loading…</p>
        ) : (
          <ul>
            {bookings.map(b => (
              <li key={b.id}>
                {b.startDate} → {b.endDate} — {b.userName}
                {b.note ? ` (${b.note})` : ""}
              </li>
            ))}
          </ul>
        )}
        <button onClick={handleAddDemo} disabled={createBooking.isPending}>
          {createBooking.isPending ? "Booking…" : "Add demo booking"}
        </button>
      </div>
    </section>
  )
}
