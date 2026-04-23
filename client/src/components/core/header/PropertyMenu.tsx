import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { useAppDispatch, useAppSelector } from "@/app/hooks"
import {
  selectSelectedPropertyId,
  setSelectedPropertyId,
} from "@/features/property/propertySlice"
import PropertySwitcher from "./PropertySwitcher.tsx"
import styles from "./Header.module.css"

export default function PropertyMenu() {
  const trpc = useTRPC()
  const { data: properties, isLoading } = useQuery(
    trpc.property.list.queryOptions(),
  )
  const selectedId = useAppSelector(selectSelectedPropertyId)
  const dispatch = useAppDispatch()

  const list = properties ?? []

  useEffect(() => {
    if (list.length === 0) return
    const stillExists = list.some(p => p.id === selectedId)
    if (!stillExists) {
      dispatch(setSelectedPropertyId(list[0].id))
    }
  }, [list, selectedId, dispatch])

  const current = list.find(p => p.id === selectedId)

  let label: string
  if (isLoading) {
    label = "Loading…"
  } else if (current) {
    label = current.name
  } else {
    label = "No property"
  }

  return (
    <div className={styles.menu}>
      <span>{label}</span>
      <PropertySwitcher
        properties={list}
        value={selectedId}
        onChange={id => { dispatch(setSelectedPropertyId(id)) }}
      />
    </div>
  )
}