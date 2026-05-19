import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { useTRPC } from "@/trpc/trpc.ts"
import { startOfSunday, toIso } from "@/utils/dateUtils"
import WeatherSymbol from "./WeatherSymbol"
import styles from "./NowWeather.module.css"

export default function NowWeather() {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId()
  const weekStart = toIso(startOfSunday(new Date()))

  const { data } = useQuery(
    trpc.weather.forProperty.queryOptions(
      { property_id: propertyId ?? 0, week_start: weekStart },
      {
        enabled: propertyId != null,
        staleTime: 10 * 60_000,
        gcTime: 30 * 60_000,
      },
    ),
  )

  if (!data?.now) return null

  return (
    <span
      aria-label={t("Current weather")}
      className={styles.now}
    >
      <WeatherSymbol code={data.now.symbol_code} />
      <strong>{Math.round(data.now.temperature_c)}°</strong>
    </span>
  )
}
