import { type SyntheticEvent, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Button,
  Fieldset,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { fdString } from "@/utils/formData"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { ErrorAlert } from "./ErrorAlert"

export function ChildrenSection() {
  const { t } = useTranslation("usersettings")
  const trpc = useTRPC()

  const { data: children } = useQuery(trpc.user.listMyChildren.queryOptions())

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState("")

  const childrenKeys = [trpc.user.listMyChildren.queryKey()]

  const createChild = useMutationWithInvalidation(
    trpc.user.createChild.mutationOptions(),
    childrenKeys,
  )

  const updateChild = useMutationWithInvalidation(
    trpc.user.updateChild.mutationOptions({
      onSuccess: () => { setEditingId(null) },
    }),
    childrenKeys,
  )

  const removeChild = useMutationWithInvalidation(
    trpc.user.removeChild.mutationOptions(),
    childrenKeys,
  )

  const handleAddChild = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const childName = fdString(fd, "name").trim()
    if (!childName) return
    createChild.mutate(
      { name: childName },
      { onSuccess: () => { form.reset() } },
    )
  }

  const startEdit = (id: number, currentName: string) => {
    setEditingId(id)
    setEditDraft(currentName)
  }

  const handleEditSubmit = (e: SyntheticEvent<HTMLFormElement>, id: number) => {
    e.preventDefault()
    const trimmed = editDraft.trim()
    if (!trimmed) return
    updateChild.mutate({ id, name: trimmed })
  }

  const handleRemove = (id: number, childName: string) => {
    if (!window.confirm(t("Remove {{name}}?", { name: childName }))) return
    removeChild.mutate({ id })
  }

  return (
    <section>
      <h2>{t("My children (under 13)")}</h2>
      {children && children.length > 0 ? (
        <ul>
          {children.map(c => (
            <li key={c.id}>
              {editingId === c.id ? (
                <form onSubmit={e => { handleEditSubmit(e, c.id) }}>
                  <Textfield
                    label={t("Name")}
                    type="text"
                    value={editDraft}
                    onChange={e => { setEditDraft(e.target.value) }}
                    required
                    autoFocus
                  />
                  <Button type="submit" disabled={updateChild.isPending}>
                    {t("Save")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => { setEditingId(null) }}
                    disabled={updateChild.isPending}
                  >
                    {t("Cancel")}
                  </Button>
                </form>
              ) : (
                <>
                  <span>{c.name}</span>
                  <Button
                    type="button"
                    onClick={() => { startEdit(c.id, c.name) }}
                  >
                    {t("Edit")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => { handleRemove(c.id, c.name) }}
                    disabled={removeChild.isPending}
                  >
                    {t("Remove")}
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t("No children yet.")}</p>
      )}
      <ErrorAlert error={updateChild.error ?? removeChild.error} />

      <form onSubmit={handleAddChild}>
        <Fieldset>
          <Fieldset.Legend>{t("Add child (under 13)")}</Fieldset.Legend>
          <Textfield label={t("Name")} type="text" name="name" required />
          <Button type="submit" disabled={createChild.isPending}>
            {t("Add")}
          </Button>
          <ErrorAlert error={createChild.error} />
        </Fieldset>
      </form>
    </section>
  )
}
