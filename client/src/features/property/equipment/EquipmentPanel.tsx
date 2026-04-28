import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

type Props = {
  propertyId: number
  propertyName: string
}

export function EquipmentPanel({ propertyId, propertyName }: Props) {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: equipment } = useSuspenseQuery(
    trpc.equipment.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: buildings } = useSuspenseQuery(
    trpc.building.list.queryOptions(),
  )

  const propertyBuildings = buildings.filter(
    b => b.property_id === propertyId,
  )
  const buildingNameById = new Map(buildings.map(b => [b.id, b.name]))

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

  const [isAddOpen, setIsAddOpen] = useState(false)

  const handleAdd = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = fdString(fd, "name").trim()
    const buildingRaw = fdString(fd, "building_id").trim()
    const category = fdString(fd, "category").trim()
    const notes = fdString(fd, "notes").trim()
    const building_id = Number(buildingRaw)
    if (!name || !buildingRaw || !Number.isFinite(building_id)) return
    createEquipment.mutate(
      {
        name,
        property_id: propertyId,
        building_id,
        category: category || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          form.reset()
          setIsAddOpen(false)
        },
      },
    )
  }

  const canAdd = propertyBuildings.length > 0

  return (
    <section>
      <h3>Equipment at {propertyName}</h3>

      {createEquipment.error && (
        <p role="alert">Error: {createEquipment.error.message}</p>
      )}

      {equipment.length === 0 ? (
        <p>No equipment yet.</p>
      ) : (
        <ul>
          {equipment.map(item => (
            <li key={item.id}>
              <strong>{item.name}</strong>
              {" — "}
              {buildingNameById.get(item.building_id) ?? `building #${String(item.building_id)}`}
              {item.category ? ` (${item.category})` : ""}
              {item.notes ? ` — ${item.notes}` : ""}
            </li>
          ))}
        </ul>
      )}

      {isAddOpen ? (
        <form onSubmit={handleAdd}>
          <fieldset>
            <legend>Add equipment</legend>
            <div>
              <label>
                Name
                <input type="text" name="name" required autoFocus />
              </label>
            </div>
            <div>
              <label>
                Building
                <select name="building_id" required defaultValue="">
                  <option value="" disabled>
                    (select building)
                  </option>
                  {propertyBuildings.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <label>
                Category
                <input
                  type="text"
                  name="category"
                  maxLength={32}
                  placeholder="appliance, tool, boat…"
                />
              </label>
            </div>
            <div>
              <label>
                Notes
                <input type="text" name="notes" maxLength={255} />
              </label>
            </div>
            <div>
              <button type="submit" disabled={createEquipment.isPending}>
                Save
              </button>
              <button
                type="button"
                onClick={() => { setIsAddOpen(false) }}
                disabled={createEquipment.isPending}
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => { setIsAddOpen(true) }}
          disabled={!canAdd}
          title={canAdd ? undefined : "Add a building first"}
        >
          Add equipment
        </button>
      )}
    </section>
  )
}