import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Button,
  Fieldset,
  Heading,
  Select,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { fdString } from "@/utils/formData"
import { useTRPC } from "@/trpc/trpc"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import styles from "./ChildrenSection.module.css"

export function ChildrenSection() {
  const { t } = useTranslation("usersettings")
  const trpc = useTRPC()

  const { data: children } = useQuery(trpc.user.listMyChildren.queryOptions())
  const { data: linkableParents } = useQuery(
    trpc.user.listLinkableParents.queryOptions(),
  )

  const [editingId, setEditingId] = useState<number | null>(null)

  const childrenKeys = [trpc.user.listMyChildren.queryKey()]

  const createChild = useMutationWithInvalidation(
    trpc.user.createChild.mutationOptions(),
    childrenKeys,
  )

  const updateChild = useMutationWithInvalidation(
    trpc.user.updateChild.mutationOptions({
      onSuccess: () => {
        setEditingId(null)
      },
    }),
    childrenKeys,
  )

  const removeChild = useMutationWithInvalidation(
    trpc.user.removeChild.mutationOptions(),
    childrenKeys,
  )

  const addParent = useMutationWithInvalidation(
    trpc.user.addParent.mutationOptions(),
    childrenKeys,
  )

  const removeParent = useMutationWithInvalidation(
    trpc.user.removeParent.mutationOptions(),
    childrenKeys,
  )

  const { pending: editPending, error: editError } = useMutationsStatus(
    updateChild,
    removeChild,
    addParent,
    removeParent,
  )

  const handleAddChild = async (fd: FormData) => {
    const childName = fdString(fd, "name").trim()
    if (!childName) return
    try {
      await createChild.mutateAsync({ name: childName })
    } catch {
      /* surfaced via createChild.error */
    }
  }

  const handleEditSubmit = (id: number) => async (fd: FormData) => {
    const trimmed = fdString(fd, "name").trim()
    if (!trimmed) return
    try {
      await updateChild.mutateAsync({ id, name: trimmed })
    } catch {
      /* surfaced via useMutationsStatus */
    }
  }

  const handleRemove = (id: number, childName: string) => {
    if (!window.confirm(t("Remove {{name}}?", { name: childName }))) return
    removeChild.mutate({ id })
  }

  const handleAddParent = (childId: number) => async (fd: FormData) => {
    const parentUserId = Number(fdString(fd, "parentUserId"))
    if (!parentUserId) return
    try {
      await addParent.mutateAsync({ childId, parentUserId })
    } catch {
      /* surfaced via useMutationsStatus */
    }
  }

  const handleRemoveParent = (
    childId: number,
    parentUserId: number,
    parentName: string,
  ) => {
    if (
      !window.confirm(t("Remove {{name}} as a parent?", { name: parentName }))
    )
      return
    removeParent.mutate({ childId, parentUserId })
  }

  return (
    <section>
      <Heading level={2}>{t("My children (under 13)")}</Heading>
      {children && children.length > 0 ? (
        <ul className={styles.list}>
          {children.map(c => {
            const parentIds = new Set(c.parents.map(p => p.id))
            const candidates = (linkableParents ?? []).filter(
              u => !parentIds.has(u.id),
            )
            return (
              <li key={c.id}>
                {editingId === c.id ? (
                  <form
                    key={`edit-child-${String(c.id)}`}
                    className={styles.row}
                    action={handleEditSubmit(c.id)}
                  >
                    <Textfield
                      className={styles.field}
                      label={t("Name")}
                      type="text"
                      name="name"
                      defaultValue={c.name}
                      required
                      autoFocus
                    />
                    <SubmitButton disabled={editPending}>
                      {t("Save")}
                    </SubmitButton>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setEditingId(null)
                      }}
                      disabled={editPending}
                    >
                      {t("Cancel")}
                    </Button>
                  </form>
                ) : (
                  <div className={styles.child}>
                    <div className={styles.row}>
                      <span className={styles.name}>{c.name}</span>
                      <Button
                        type="button"
                        onClick={() => {
                          setEditingId(c.id)
                        }}
                      >
                        {t("Edit")}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          handleRemove(c.id, c.name)
                        }}
                        disabled={editPending}
                      >
                        {t("Remove")}
                      </Button>
                    </div>

                    <div className={styles.parents}>
                      <span className={styles.parentsLabel}>
                        {t("Parents")}:
                      </span>
                      {c.parents.map(p => (
                        <span key={p.id} className={styles.parentChip}>
                          {p.name}
                          {!p.isCreator && (
                            <Button
                              type="button"
                              variant="tertiary"
                              data-size="sm"
                              onClick={() => {
                                handleRemoveParent(c.id, p.id, p.name)
                              }}
                              disabled={editPending}
                            >
                              {t("Remove")}
                            </Button>
                          )}
                        </span>
                      ))}
                    </div>

                    {c.parents.length < 2 && candidates.length > 0 && (
                      <form
                        className={styles.row}
                        action={handleAddParent(c.id)}
                      >
                        <Select
                          className={styles.field}
                          name="parentUserId"
                          aria-label={t("Add another parent")}
                          data-size="sm"
                          defaultValue=""
                          required
                        >
                          <Select.Option value="" disabled>
                            {t("Choose a person")}
                          </Select.Option>
                          {candidates.map(u => (
                            <Select.Option key={u.id} value={String(u.id)}>
                              {u.name}
                            </Select.Option>
                          ))}
                        </Select>
                        <SubmitButton disabled={editPending}>
                          {t("Add parent")}
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState title={t("No children yet.")} />
      )}
      <ErrorAlert error={editError} />

      <form action={handleAddChild}>
        <Fieldset>
          <Fieldset.Legend>{t("Add child (under 13)")}</Fieldset.Legend>
          <div className={styles.row}>
            <Textfield
              className={styles.field}
              label={t("Name")}
              type="text"
              name="name"
              required
            />
            <SubmitButton disabled={createChild.isPending}>
              {t("Add")}
            </SubmitButton>
          </div>
          <ErrorAlert error={createChild.error} />
        </Fieldset>
      </form>
    </section>
  )
}
