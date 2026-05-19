type Props = {
  code: string | null
  size?: number
}

const EMOJI: Record<string, string> = {
  clearsky_day: "☀️",
  clearsky_night: "🌛",
  clearsky_polartwilight: "🌅",
  fair_day: "🌤️",
  fair_night: "🌜",
  fair_polartwilight: "🌅",
  partlycloudy_day: "⛅",
  partlycloudy_night: "☁️",
  partlycloudy_polartwilight: "⛅",
  cloudy: "☁️",
  fog: "🌫️",
  lightrain: "🌦️",
  rain: "🌧️",
  heavyrain: "⛈️",
  lightsleet: "🌨️",
  sleet: "🌨️",
  heavysleet: "🌨️",
  lightsnow: "🌨️",
  snow: "❄️",
  heavysnow: "❄️",
  thunder: "⛈️",
}

function symbolToEmoji(code: string): string {
  if (EMOJI[code]) return EMOJI[code]
  const root = code.replace(/_(day|night|polartwilight)$/, "")
  if (EMOJI[root]) return EMOJI[root]
  if (root.includes("thunder")) return "⛈️"
  if (root.includes("snow")) return "❄️"
  if (root.includes("sleet")) return "🌨️"
  if (root.includes("rain")) return "🌧️"
  if (root.includes("fog")) return "🌫️"
  if (root.includes("cloud")) return "☁️"
  return "🌤️"
}

export default function WeatherSymbol({ code, size = 20 }: Props) {
  if (!code) return null
  return (
    <span
      role="img"
      aria-label={code.replace(/_/g, " ")}
      style={{ fontSize: size, lineHeight: 1 }}
    >
      {symbolToEmoji(code)}
    </span>
  )
}
