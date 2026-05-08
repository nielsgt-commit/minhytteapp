import { type SyntheticEvent, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Alert, Button, Card, Heading, Textfield } from "@digdir/designsystemet-react"
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
          queryKey: trpc.maintenance.pathKey(),
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
    <Card asChild>
      <section>
        <Card.Block>
          <Heading level={4} data-size="xs">{buildingName}</Heading>
        </Card.Block>
        <Card.Block>
          {!adding && (
            <Button
              variant="tertiary"
              onClick={() => { setAdding(true) }}
              disabled={selectedUserId == null}
            >
              Add todo
            </Button>
          )}
          {adding && (
            <form onSubmit={handleAddSubmit}>
              <Textfield
                aria-label="Task description"
                name="description"
                placeholder="Task description"
                required
                autoFocus
              />
              <Button
                type="submit"
                disabled={createMutation.isPending || selectedUserId == null}
              >
                Create
              </Button>
              <Button
                variant="secondary"
                disabled={createMutation.isPending}
                onClick={() => { setAdding(false) }}
              >
                Cancel
              </Button>
            </form>
          )}
          {createMutation.error && (
            <Alert data-color="danger">Error: {createMutation.error.message}</Alert>
          )}
        </Card.Block>
        <Card.Block>
          <BuildingTodos buildingId={buildingId} />
        </Card.Block>
        <Card.Block>
          <Button
            variant="tertiary"
            onClick={() => { setShowHistory(v => !v) }}
          >
            {showHistory ? "Hide history" : "Show history"}
          </Button>
          {showHistory && <MaintenanceHistory buildingId={buildingId} />}
        </Card.Block>
      </section>
    </Card>
  )
}