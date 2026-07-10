import { useState } from "react"
import {
  Button,
  Card,
  List,
  Paragraph,
  Tag,
} from "@digdir/designsystemet-react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Temporal } from "temporal-polyfill"
import { useSelectedPropertyId } from "@/selection/useSelection"
import { useTRPC } from "@/trpc/trpc"
import section from "@/components/layouts/manageSection.module.css"
import { useCanEdit } from "@/hooks/useCanEdit"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { InlineEditRow } from "@/components/shared/InlineEditRow"
import { formatDateRange } from "@/utils/dateUtils"
import { SeasonForm, type SeasonFormValues } from "./SeasonForm.tsx"
import { seasonInstanceYear, seasonWindow } from "@/utils/seasonUtils"
import styles from "./ManageSeasons.module.css"

type WireSeason = {
  id: number
  name: string
  start_month: number
  start_day: number
  end_month: number
  end_day: number
  priority_weeks: number[]
}

export function ManageSeasons() {
  const { t, i18n } = useTranslation("property")
  const trpc = useTRPC()
  const property_id = useSelectedPropertyId()
  const canEdit = useCanEdit()

  const { data: seasons } = useQuery(
    trpc.season.list.queryOptions(
      { property_id: property_id ?? 0 },
      { enabled: property_id != null },
    ),
  )

  const seasonKeys = [trpc.season.list.queryKey()]
  const createMutation = useMutationWithInvalidation(
    trpc.season.create.mutationOptions(),
    seasonKeys,
  )
  const updateMutation = useMutationWithInvalidation(
    trpc.season.update.mutationOptions(),
    seasonKeys,
  )
  const archiveMutation = useMutationWithInvalidation(
    trpc.season.archive.mutationOptions(),
    seasonKeys,
  )

  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const { pending, error: lastError } = useMutationsStatus(
    createMutation,
    updateMutation,
    archiveMutation,
  )

  if (property_id == null) return null

  const handleAdd = async (values: SeasonFormValues) => {
    try {
      await createMutation.mutateAsync({ property_id, ...values })
      setIsAdding(false)
    } catch {
      /* surfaced via useMutationsStatus lastError */
    }
  }

  const handleSave = (s: WireSeason) => async (values: SeasonFormValues) => {
    try {
      await updateMutation.mutateAsync({ id: s.id, property_id, ...values })
      setEditingId(null)
    } catch {
      /* surfaced via useMutationsStatus lastError */
    }
  }

  const handleArchive = (s: WireSeason) => {
    if (!window.confirm(t('Archive season "{{name}}"?', { name: s.name })))
      return
    archiveMutation.mutate(
      { id: s.id, property_id },
      {
        onSuccess: () => {
          setEditingId(null)
        },
      },
    )
  }

  // The recurring range plus the concrete dates of the current-or-next
  // instance, so "Dec 1 – Feb 28" reads as "Dec 1, 2026 – Feb 28, 2027".
  const describeSeason = (s: WireSeason) => {
    const season = { ...s, id: s.id as number | null }
    const today = Temporal.Now.plainDateISO()
    const window = seasonWindow(season, seasonInstanceYear(season, today))
    return formatDateRange(
      window.start,
      window.end.subtract({ days: 1 }),
      i18n.language,
    )
  }

  return (
    <div className={section.column}>
      <ErrorAlert error={lastError} />

      {seasons?.length === 0 && (
        <Paragraph>
          {t(
            "No seasons configured. The built-in Summer season (June–July, priority weeks 28–30) is used until you add one.",
          )}
        </Paragraph>
      )}

      <List.Unordered className={styles.list}>
        {seasons?.map(s => (
          <Card asChild key={s.id}>
            <List.Item>
              <Card.Block className={styles.row}>
                <InlineEditRow
                  editing={editingId === s.id}
                  canEdit={canEdit}
                  pending={pending}
                  editLabel={t("Edit season {{name}}", { name: s.name })}
                  onStartEdit={() => {
                    setEditingId(s.id)
                  }}
                  view={
                    <div className={styles.summary}>
                      <span className={styles.name}>{s.name}</span>
                      <span className={styles.dates}>{describeSeason(s)}</span>
                      {s.priority_weeks.length > 0 && (
                        <Tag data-color="info" data-size="sm">
                          {t("Weeks {{weeks}}", {
                            weeks: s.priority_weeks.join(", "),
                          })}
                        </Tag>
                      )}
                    </div>
                  }
                  form={
                    <SeasonForm
                      legend={t("Edit season")}
                      submitLabel={t("Save")}
                      initial={s}
                      pending={pending}
                      onSubmit={handleSave(s)}
                      onCancel={() => {
                        setEditingId(null)
                      }}
                    />
                  }
                  actions={
                    <Button
                      variant="tertiary"
                      data-color="danger"
                      data-size="sm"
                      disabled={pending}
                      onClick={() => {
                        handleArchive(s)
                      }}
                    >
                      {t("Archive")}
                    </Button>
                  }
                />
              </Card.Block>
            </List.Item>
          </Card>
        ))}

        {canEdit && (
          <Card asChild key="__add">
            <List.Item>
              <Card.Block className={styles.addBlock}>
                {isAdding ? (
                  <SeasonForm
                    legend={t("New season")}
                    submitLabel={t("Add season")}
                    pending={pending}
                    onSubmit={handleAdd}
                    onCancel={() => {
                      setIsAdding(false)
                    }}
                  />
                ) : (
                  <Button
                    variant="tertiary"
                    className={styles.addButton}
                    disabled={pending}
                    onClick={() => {
                      setIsAdding(true)
                    }}
                  >
                    {t("+ Add season")}
                  </Button>
                )}
              </Card.Block>
            </List.Item>
          </Card>
        )}
      </List.Unordered>
    </div>
  )
}
