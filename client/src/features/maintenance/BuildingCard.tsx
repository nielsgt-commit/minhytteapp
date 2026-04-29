import { type SyntheticEvent, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import styles from "./BuildingCard.module.css"
import { MaintenanceHistory } from "@/features/maintenance/MaintenanceHistory.tsx"
import { BuildingTodos } from "@/features/maintenance/BuildingTodos.tsx"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedUserId } from "@/features/user/userSlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

export function BuildingCard({
  buildingId,
  buildingName,
}: {
  buildingId: number
  buildingName: string
}) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedUserId = useAppSelector(selectSelectedUserId)

  const [adding, setAdding] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const createMutation = useMutation(
    trpc.maintenance.create.mutationOptions({
      onSuccess: () => {
        setAdding(false)
        void qc.invalidateQueries({
          queryKey: trpc.maintenance.list.queryKey(),
        })
      },
    }),
  )

  const handleAddSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (selectedUserId == null) return
    const fd = new FormData(e.currentTarget)
    const rawDescription = fd.get("description")
    const description =
      typeof rawDescription === "string" ? rawDescription.trim() : ""
    if (!description) return
    createMutation.mutate({
      description,
      added_by: selectedUserId,
      building_id: buildingId,
      category: "maintenance",
      severity: "minor",
      status: "todo",
      recurrence: "once",
    })
  }

  return (
    <section className={styles.card}>
      <h4 className={styles.title}>{buildingName}</h4>
      <div className={styles.addtodo}>
        {!adding && (
          <button
            type="button"
            onClick={() => { setAdding(true) }}
            disabled={selectedUserId == null}
          >
            Add todo
          </button>
        )}
        {adding && (
          <form onSubmit={handleAddSubmit}>
            <input
              type="text"
              name="description"
              placeholder="Task description"
              required
              autoFocus
            />
            <button
              type="submit"
              disabled={createMutation.isPending || selectedUserId == null}
            >
              Create
            </button>
            <button
              type="button"
              disabled={createMutation.isPending}
              onClick={() => { setAdding(false) }}
            >
              Cancel
            </button>
          </form>
        )}
        {createMutation.error && (
          <p role="alert">Error: {createMutation.error.message}</p>
        )}
      </div>
      <div className={styles.todos}>
        <BuildingTodos buildingId={buildingId} />
      </div>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => { setShowHistory(v => !v) }}
      >
        {showHistory ? "Hide history" : "Show history"}
      </button>
      {showHistory && (
        <div className={styles.history}>
          <MaintenanceHistory buildingId={buildingId} />
        </div>
      )}
    </section>
  )
}