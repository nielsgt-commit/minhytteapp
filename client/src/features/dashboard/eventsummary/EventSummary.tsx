import { useState, type SyntheticEvent } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

export default function EventSummary() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const propertyId = useAppSelector(selectSelectedPropertyId)
  const [body, setBody] = useState("")
  const [expiresOn, setExpiresOn] = useState("")

  const { data: me } = useQuery(trpc.user.me.queryOptions())
  const { data: events } = useQuery(
    trpc.event.list.queryOptions(
      { property_id: propertyId ?? 0 },
      { enabled: propertyId != null },
    ),
  )

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: trpc.event.list.queryKey() })
  }

  const create = useMutation(
    trpc.event.create.mutationOptions({
      onSuccess: () => {
        setBody("")
        setExpiresOn("")
        invalidate()
      },
    }),
  )
  const remove = useMutation(
    trpc.event.delete.mutationOptions({ onSuccess: () => { invalidate() } }),
  )

  if (propertyId == null) return null

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = body.trim()
    if (trimmed.length === 0) return
    create.mutate({
      property_id: propertyId,
      body: trimmed,
      expires_on: expiresOn === "" ? null : expiresOn,
    })
  }

  return (
    <section>
      <h3>Events</h3>

      <form onSubmit={handleSubmit}>
        <label>
          Message
          <textarea
            value={body}
            onChange={e => { setBody(e.target.value) }}
            maxLength={280}
            rows={2}
            required
          />
        </label>
        <label>
          Expires on (optional)
          <input
            type="date"
            value={expiresOn}
            onChange={e => { setExpiresOn(e.target.value) }}
          />
        </label>
        <button type="submit" disabled={create.isPending || body.trim() === ""}>
          Post
        </button>
        {create.error && <p role="alert">Error: {create.error.message}</p>}
      </form>

      {events == null ? (
        <p>Loading…</p>
      ) : events.length === 0 ? (
        <p>No active events.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {events.map(ev => {
            const canDelete = me?.id === ev.author_id || me?.is_admin === true
            return (
              <li key={ev.id}>
                {ev.body}
                <br />
                <small>
                  — {ev.author_name}
                  {ev.expires_on ? `, until ${ev.expires_on}` : ""}
                </small>
                {canDelete && (
                  <>
                    {" "}
                    <button
                      type="button"
                      disabled={remove.isPending}
                      onClick={() => { remove.mutate({ id: ev.id }) }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}