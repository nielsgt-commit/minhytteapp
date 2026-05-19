import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Button,
  Card,
  Switch,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc.ts"
import styles from "./InfrastructurePanel.module.css"

type Props = {
  propertyId: number
  propertyName: string
}

type Infrastructure = {
  id: number
  name: string
  description: string
  property_id: number | null
}

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

export function InfrastructurePanel({ propertyId, propertyName }: Props) {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: infrastructure } = useSuspenseQuery(
    trpc.infrastructure.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const invalidate = () => {
    void qc.invalidateQueries({
      queryKey: trpc.infrastructure.listForProperty.queryKey({
        property_id: propertyId,
      }),
    })
  }

  const createInfrastructure = useMutation(
    trpc.infrastructure.create.mutationOptions({ onSuccess: invalidate }),
  )
  const updateInfrastructure = useMutation(
    trpc.infrastructure.update.mutationOptions({ onSuccess: invalidate }),
  )
  const deleteInfrastructure = useMutation(
    trpc.infrastructure.delete.mutationOptions({ onSuccess: invalidate }),
  )

  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const lastError =
    createInfrastructure.error ?? updateInfrastructure.error ?? deleteInfrastructure.error
  const pending =
    createInfrastructure.isPending || updateInfrastructure.isPending || deleteInfrastructure.isPending

  const editingInfrastructure = editingId
    ? infrastructure.find(p => p.id === editingId) ?? null
    : null

  const handleAdd = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = fdString(fd, "name").trim()
    const description = fdString(fd, "description").trim()
    if (!name || !description) return
    createInfrastructure.mutate(
      { name, description, property_id: propertyId },
      {
        onSuccess: () => {
          form.reset()
          setIsAdding(false)
        },
      },
    )
  }

  const handleSave =
    (p: Infrastructure) => (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const fd = new FormData(e.currentTarget)
      const name = fdString(fd, "name").trim()
      const description = fdString(fd, "description").trim()
      if (!name || !description) return
      updateInfrastructure.mutate(
        { id: p.id, name, description, property_id: propertyId },
        { onSuccess: () => { setEditingId(null) } },
      )
    }

  const handleDelete = (p: Infrastructure) => {
    if (!window.confirm(`Delete infrastructure "${p.name}"?`)) return
    deleteInfrastructure.mutate(
      { id: p.id },
      { onSuccess: () => { setEditingId(null) } },
    )
  }

  return (
    <section>
      <h3>Infrastructure at {propertyName}</h3>

      <Switch
        label="Edit mode"
        checked={editMode}
        onChange={e => {
          const next = e.target.checked
          setEditMode(next)
          if (!next) {
            setEditingId(null)
            setIsAdding(false)
          }
        }}
      />

      {lastError && <p role="alert">Error: {lastError.message}</p>}

      {editingInfrastructure ? (
        <form
          onSubmit={handleSave(editingInfrastructure)}
          key={`edit-${String(editingInfrastructure.id)}`}
          className={styles.editForm}
        >
          <Textfield
            label="Name"
            name="name"
            required
            autoFocus
            defaultValue={editingInfrastructure.name}
            disabled={updateInfrastructure.isPending}
          />
          <Textfield
            label="Description"
            name="description"
            required
            defaultValue={editingInfrastructure.description}
            disabled={updateInfrastructure.isPending}
          />
          <div className={styles.actions}>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
            <Button
              type="button"
              variant="secondary"
              data-color="danger"
              disabled={pending}
              onClick={() => { handleDelete(editingInfrastructure) }}
            >
              Delete
            </Button>
            <Button
              type="button"
              variant="tertiary"
              disabled={pending}
              onClick={() => { setEditingId(null) }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <ul className={styles.list}>
          {infrastructure.map(p => (
            <Card asChild key={p.id}>
              <li>
                <Card.Block className={styles.row}>
                  <span className={styles.rowName}>{p.name}</span>
                  {editMode && (
                    <>
                      <Button
                        variant="tertiary"
                        data-size="sm"
                        disabled={pending}
                        onClick={() => { setEditingId(p.id) }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="tertiary"
                        data-color="danger"
                        data-size="sm"
                        disabled={pending}
                        onClick={() => { handleDelete(p) }}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </Card.Block>
              </li>
            </Card>
          ))}

          <Card asChild key="__add">
            <li>
              <Card.Block className={styles.addBlock}>
                {isAdding ? (
                  <>
                    <strong>Add infrastructure</strong>
                    <form
                      onSubmit={handleAdd}
                      className={styles.addForm}
                    >
                      <Textfield
                        label="Name"
                        name="name"
                        required
                        autoFocus
                        disabled={createInfrastructure.isPending}
                      />
                      <Textfield
                        label="Description"
                        name="description"
                        required
                        disabled={createInfrastructure.isPending}
                      />
                      <div className={styles.actions}>
                        <Button type="submit" disabled={createInfrastructure.isPending}>
                          Add infrastructure
                        </Button>
                        <Button
                          type="button"
                          variant="tertiary"
                          disabled={createInfrastructure.isPending}
                          onClick={() => { setIsAdding(false) }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </>
                ) : (
                  <Button
                    variant="tertiary"
                    className={styles.addButton}
                    disabled={pending}
                    onClick={() => { setIsAdding(true) }}
                  >
                    + Add infrastructure
                  </Button>
                )}
              </Card.Block>
            </li>
          </Card>
        </ul>
      )}
    </section>
  )
}
