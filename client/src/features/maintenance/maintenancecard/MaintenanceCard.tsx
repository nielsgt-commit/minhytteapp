import { useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Card,
  Dropdown,
  Heading,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import {
  CameraIcon,
  ClipboardCheckmarkIcon,
  ClockDashedIcon,
  ImageIcon,
  MenuElipsisVerticalIcon,
} from "@navikt/aksel-icons"
import styles from "./MaintenanceCard.module.css"
import { coverImageUrl } from "@/components/shared/CoverImageControl"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { useCoverUpload } from "@/hooks/useCoverUpload"
import { InspectionFlow } from "@/features/maintenance/inspectionflow/InspectionFlow.tsx"
import { MaintenanceHistory } from "@/features/maintenance/maintenancecard/MaintenanceHistory.tsx"
import { MaintenanceTodos } from "@/features/maintenance/maintenancecard/MaintenanceTodos.tsx"
import { useIsMobile } from "@/hooks/useIsMobile.ts"
import { useSelectedPropertyId } from "@/selection/useSelection"
import { useTRPC } from "@/trpc/trpc.ts"
import { BottomSheet } from "@/components/shared/BottomSheet"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"

export type MaintenanceScope =
  | { kind: "structure"; id: number; name: string; builtYear?: number | null }
  | {
      kind: "infrastructure"
      id: number
      name: string
      builtYear?: number | null
    }
  | { kind: "equipment"; id: number; name: string; builtYear?: number | null }

export function MaintenanceCard({
  scope,
  imageId = null,
}: {
  scope: MaintenanceScope
  imageId?: number | null
}) {
  const { t } = useTranslation("maintenance")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const [sheet, setSheet] = useState<
    "none" | "todos" | "history" | "inspection"
  >("none")
  const [menuOpen, setMenuOpen] = useState(false)
  const isMobile = useIsMobile()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const upload = useCoverUpload(scope.kind, scope.id)

  const pickPhoto = () => {
    fileInputRef.current?.click()
  }

  // Shares its cache key with MaintenanceTodos/MaintenanceHistory, so this only
  // surfaces the summary counts already loaded for the card's sheet views.
  const { data: items } = useQuery(
    trpc.maintenance.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )

  const matchesScope = (i: NonNullable<typeof items>[number]) =>
    scope.kind === "structure"
      ? i.structure_id === scope.id
      : scope.kind === "infrastructure"
        ? i.infrastructure_id === scope.id
        : i.equipment_id === scope.id

  const scoped = items?.filter(matchesScope) ?? []
  const openTodosCount = scoped.filter(
    i => i.status === "todo" || i.status === "doing",
  ).length

  const closeSheet = () => {
    setSheet("none")
  }

  const historyButton = (
    <Button
      variant="tertiary"
      data-size="sm"
      onClick={() => {
        setSheet("history")
      }}
    >
      <ClockDashedIcon aria-hidden fontSize="1.25rem" />
      {t("History")}
    </Button>
  )

  const todosButton = (
    <Badge.Position placement="top-right">
      {openTodosCount > 0 && <Badge count={openTodosCount} />}
      <Button
        variant="tertiary"
        data-size="sm"
        onClick={() => {
          setSheet("todos")
        }}
      >
        <ClipboardCheckmarkIcon aria-hidden fontSize="1.25rem" />
        {t("Todos")}
      </Button>
    </Badge.Position>
  )

  // On the narrowest phones the History/Todos labels stop fitting next to the
  // name, so collapse them into a kebab menu in the top-right corner instead.
  const kebabMenu = (
    <Dropdown.TriggerContext>
      <Dropdown.Trigger
        variant="tertiary"
        data-size="sm"
        icon
        aria-label={t("More actions")}
      >
        <Badge.Position placement="top-right">
          {isMobile && openTodosCount > 0 && <Badge count={openTodosCount} />}
          <MenuElipsisVerticalIcon aria-hidden fontSize="1.25rem" />
        </Badge.Position>
      </Dropdown.Trigger>
      <Dropdown
        placement="bottom-end"
        open={menuOpen}
        onOpen={() => {
          setMenuOpen(true)
        }}
        onClose={() => {
          setMenuOpen(false)
        }}
      >
        <Dropdown.List>
          {isMobile && (
            <Dropdown.Item>
              <Dropdown.Button
                className={styles.menuItem}
                onClick={() => {
                  setSheet("todos")
                  setMenuOpen(false)
                }}
              >
                <ClipboardCheckmarkIcon aria-hidden fontSize="1.25rem" />
                {t("Todos")}
                {openTodosCount > 0 && (
                  <Badge
                    className={styles.menuCount}
                    count={openTodosCount}
                    data-color="accent"
                  />
                )}
              </Dropdown.Button>
            </Dropdown.Item>
          )}
          {isMobile && (
            <Dropdown.Item>
              <Dropdown.Button
                className={styles.menuItem}
                onClick={() => {
                  setSheet("history")
                  setMenuOpen(false)
                }}
              >
                <ClockDashedIcon aria-hidden fontSize="1.25rem" />
                {t("History")}
              </Dropdown.Button>
            </Dropdown.Item>
          )}
          {imageId != null && (
            <Dropdown.Item>
              <Dropdown.Button
                className={styles.menuItem}
                disabled={upload.isPending}
                onClick={() => {
                  setMenuOpen(false)
                  pickPhoto()
                }}
              >
                <CameraIcon aria-hidden fontSize="1.25rem" />
                {t("Change cover photo")}
              </Dropdown.Button>
            </Dropdown.Item>
          )}
        </Dropdown.List>
      </Dropdown>
    </Dropdown.TriggerContext>
  )

  const inspectButton = (
    <Button
      className={styles.inspect}
      variant="secondary"
      data-size="sm"
      onClick={() => {
        setSheet("inspection")
      }}
    >
      {t("Start inspection")}
    </Button>
  )

  return (
    <Card asChild>
      <article>
        <Card.Block className={styles.row} data-size="sm">
          <Heading level={3} data-size="xs" className={styles.name}>
            {scope.name}
          </Heading>
          {isMobile ? (
            kebabMenu
          ) : (
            <>
              {historyButton}
              {todosButton}
              {inspectButton}
              {imageId != null && kebabMenu}
            </>
          )}
        </Card.Block>
        <Card.Block className={styles.imageRow} data-size="sm">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={e => {
              const file = e.currentTarget.files?.[0]
              e.currentTarget.value = ""
              if (file) upload.mutate(file)
            }}
          />
          <ErrorAlert error={upload.error} />
          {imageId != null ? (
            <img
              src={coverImageUrl(imageId)}
              alt={t("Photo of {{name}}", { name: scope.name })}
              className={styles.coverImage}
            />
          ) : (
            <Button
              variant="tertiary"
              data-size="sm"
              disabled={upload.isPending}
              onClick={pickPhoto}
            >
              <ImageIcon aria-hidden fontSize="1.25rem" />
              {upload.isPending ? t("Uploading photo…") : t("Add photo")}
            </Button>
          )}
        </Card.Block>
        {isMobile && (
          <Card.Block className={styles.inspectRow} data-size="sm">
            {inspectButton}
          </Card.Block>
        )}
        <BottomSheet
          open={sheet === "todos"}
          onClose={closeSheet}
          title={t("Todos for {{name}}", { name: scope.name })}
        >
          <MaintenanceTodos scope={scope} />
        </BottomSheet>
        <BottomSheet
          open={sheet === "history"}
          onClose={closeSheet}
          title={t("History for {{name}}", { name: scope.name })}
        >
          <QueryBoundary>
            <MaintenanceHistory scope={scope} />
          </QueryBoundary>
        </BottomSheet>
        <BottomSheet
          open={sheet === "inspection"}
          onClose={closeSheet}
          title={t("Inspect {{name}}", { name: scope.name })}
        >
          <InspectionFlow
            scope={scope}
            open={sheet === "inspection"}
            onClose={closeSheet}
          />
        </BottomSheet>
      </article>
    </Card>
  )
}
