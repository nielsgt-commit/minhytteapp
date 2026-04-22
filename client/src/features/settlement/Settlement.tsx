import styles from "./Settlement.module.css"
import { useBalances } from "./api/queries"
import { useSettleAll } from "./api/mutations"

export function Settlement() {
  const { data: balances = [], isPending } = useBalances()
  const settleAll = useSettleAll()

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Settlement</h2>
      <div className={styles.content}>
        {isPending ? (
          <p>Loading…</p>
        ) : (
          <ul>
            {balances.map(b => (
              <li key={b.userId}>
                {b.userName}: {b.balance >= 0 ? "+" : ""}
                {b.balance} kr
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => {
            settleAll.mutate()
          }}
          disabled={settleAll.isPending}
        >
          {settleAll.isPending ? "Settling…" : "Settle all"}
        </button>
      </div>
    </section>
  )
}
