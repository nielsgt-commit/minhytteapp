import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc.ts"
import { startOfSunday, toIso } from "@/utils/dateUtils"
import WeatherSymbol from "./WeatherSymbol"
import styles from "./NowWeather.module.css"

export default function NowWeather() {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId()
  const weekStart = toIso(startOfSunday(new Date()))

  const { data: properties } = useQuery(trpc.property.mine.queryOptions())
  const property = properties?.find(p => p.id === propertyId)
  const hasCoords = property?.latitude != null && property.longitude != null

  const { data } = useQuery(
    trpc.weather.forProperty.queryOptions(
      { property_id: propertyId ?? 0, week_start: weekStart },
      {
        enabled: propertyId != null && hasCoords,
        staleTime: 10 * 60_000,
        gcTime: 30 * 60_000,
      },
    ),
  )

  if (propertyId != null && property != null && !hasCoords) {
    return (
      <Link to="/manageproperty/info" className={styles.hint}>
        {t("Add address to see local weather")}
      </Link>
    )
  }

  if (!data?.now) return null

  return (
    <span aria-label={t("Current weather")} className={styles.now}>
      <WeatherSymbol code={data.now.symbol_code} />
      <strong>{Math.round(data.now.temperature_c)}°</strong>
    </span>
  )
}
