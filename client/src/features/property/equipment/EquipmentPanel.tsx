import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Button,
  Card,
  Fieldset,
  Label,
  Select,
  Switch,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc.ts"
import { fdString } from "@/utils/formData"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"

type Props = {
  propertyId: number
  propertyName: string
}

type Equipment = {
  id: number
  name: string
  property_id: number
  structure_id: number
  category: string | null
  notes: string | null
}

export function EquipmentPanel({ propertyId, propertyName }: Props) {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: equipment } = useSuspenseQuery(
    trpc.equipment.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: structures } = useSuspenseQuery(
    trpc.structure.list.queryOptions(),
  )

  const propertyStructures = structures.filter(
    b => b.property_id === propertyId,
  )

  const invalidate = () => {
    void qc.invalidateQueries({
      queryKey: trpc.equipment.listForProperty.queryKey({
        property_id: propertyId,
      }),
    })
  }

  const createEquipment = useMutation(
    trpc.equipment.create.mutationOptions({ onSuccess: invalidate }),
  )
  const updateEquipment = useMutation(
    trpc.equipment.update.mutationOptions({ onSuccess: invalidate }),
  )
  const deleteEquipment = useMutation(
    trpc.equipment.delete.mutationOptions({ onSuccess: invalidate }),
  )

  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const { pending, error: lastError } = useMutationsStatus(
    createEquipment,
    updateEquipment,
    deleteEquipment,
  )

  const editingItem = editingId
    ? equipment.find(e => e.id === editingId) ?? null
    : null

  const handleAdd = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = fdString(fd, "name").trim()
    const structureRaw = fdString(fd, "structure_id").trim()
    const category = fdString(fd, "category").trim()
    const notes = fdString(fd, "notes").trim()
    const structure_id = Number(structureRaw)
    if (!name || !structureRaw || !Number.isFinite(structure_id)) return
    createEquipment.mutate(
      {
        name,
        property_id: propertyId,
        structure_id,
        category: category || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          form.reset()
          setIsAdding(false)
        },
      },
    )
  }

  const handleSave =
    (item: Equipment) => (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const fd = new FormData(e.currentTarget)
      const name = fdString(fd, "name").trim()
      const structureRaw = fdString(fd, "structure_id").trim()
      const category = fdString(fd, "category").trim()
      const notes = fdString(fd, "notes").trim()
      const structure_id = Number(structureRaw)
      if (!name || !structureRaw || !Number.isFinite(structure_id)) return
      updateEquipment.mutate(
        {
          id: item.id,
          name,
          property_id: propertyId,
          structure_id,
          category: category || undefined,
          notes: notes || undefined,
        },
        { onSuccess: () => { setEditingId(null) } },
      )
    }

  const handleDelete = (item: Equipment) => {
    if (!window.confirm(`Delete equipment "${item.name}"?`)) return
    deleteEquipment.mutate(
      { id: item.id },
      { onSuccess: () => { setEditingId(null) } },
    )
  }

  const canAdd = propertyStructures.length > 0

  return (
    <section>
      <h3>Equipment at {propertyName}</h3>

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

      {editingItem ? (
        <form
          onSubmit={handleSave(editingItem)}
          key={`edit-${String(editingItem.id)}`}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <Fieldset>
            <Fieldset.Legend>Edit equipment</Fieldset.Legend>
            <Textfield
              label="Name"
              name="name"
              required
              autoFocus
              defaultValue={editingItem.name}
              disabled={updateEquipment.isPending}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <Label htmlFor={`edit-structure-${String(editingItem.id)}`}>
                Structure
              </Label>
              <Select
                id={`edit-structure-${String(editingItem.id)}`}
                name="structure_id"
                required
                defaultValue={String(editingItem.structure_id)}
                disabled={updateEquipment.isPending}
              >
                {propertyStructures.map(b => (
                  <Select.Option key={b.id} value={String(b.id)}>
                    {b.name}
                  </Select.Option>
                ))}
              </Select>
            </div>
            <Textfield
              label="Category"
              name="category"
              maxLength={32}
              placeholder="appliance, tool, boat…"
              defaultValue={editingItem.category ?? ""}
              disabled={updateEquipment.isPending}
            />
            <Textfield
              label="Notes"
              name="notes"
              maxLength={255}
              defaultValue={editingItem.notes ?? ""}
              disabled={updateEquipment.isPending}
            />
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <Button type="submit" disabled={pending}>
                Save
              </Button>
              <Button
                type="button"
                variant="secondary"
                data-color="danger"
                disabled={pending}
                onClick={() => { handleDelete(editingItem) }}
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
          </Fieldset>
        </form>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {equipment.map(item => (
            <Card asChild key={item.id}>
              <li>
                <Card.Block
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>{item.name}</span>
                  {editMode && (
                    <>
                      <Button
                        variant="tertiary"
                        data-size="sm"
                        disabled={pending}
                        onClick={() => { setEditingId(item.id) }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="tertiary"
                        data-color="danger"
                        data-size="sm"
                        disabled={pending}
                        onClick={() => { handleDelete(item) }}
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
              <Card.Block
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {isAdding ? (
                  <>
                    <strong>Add equipment</strong>
                    <form
                      onSubmit={handleAdd}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      <Fieldset>
                        <Fieldset.Legend>New equipment</Fieldset.Legend>
                        <Textfield
                          label="Name"
                          name="name"
                          required
                          autoFocus
                          disabled={createEquipment.isPending}
                        />
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                          }}
                        >
                          <Label htmlFor="add-equipment-structure">Structure</Label>
                          <Select
                            id="add-equipment-structure"
                            name="structure_id"
                            required
                            defaultValue=""
                            disabled={createEquipment.isPending}
                          >
                            <Select.Option value="" disabled>
                              (select structure)
                            </Select.Option>
                            {propertyStructures.map(b => (
                              <Select.Option key={b.id} value={String(b.id)}>
                                {b.name}
                              </Select.Option>
                            ))}
                          </Select>
                        </div>
                        <Textfield
                          label="Category"
                          name="category"
                          maxLength={32}
                          placeholder="appliance, tool, boat…"
                          disabled={createEquipment.isPending}
                        />
                        <Textfield
                          label="Notes"
                          name="notes"
                          maxLength={255}
                          disabled={createEquipment.isPending}
                        />
                        <div
                          style={{
                            display: "flex",
                            gap: "0.5rem",
                            flexWrap: "wrap",
                          }}
                        >
                          <Button type="submit" disabled={createEquipment.isPending}>
                            Add equipment
                          </Button>
                          <Button
                            type="button"
                            variant="tertiary"
                            disabled={createEquipment.isPending}
                            onClick={() => { setIsAdding(false) }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </Fieldset>
                    </form>
                  </>
                ) : (
                  <Button
                    variant="tertiary"
                    style={{
                      flex: 1,
                      minHeight: "4rem",
                      alignSelf: "stretch",
                    }}
                    disabled={pending || !canAdd}
                    title={canAdd ? undefined : "Add a structure first"}
                    onClick={() => { setIsAdding(true) }}
                  >
                    + Add equipment
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
