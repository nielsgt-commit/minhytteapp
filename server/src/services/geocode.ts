const KARTVERKET_URL = "https://ws.geonorge.no/adresser/v1/sok"

type KartverketResponse = {
  adresser?: {
    representasjonspunkt?: { lat?: number; lon?: number }
  }[]
}

function truncate4(n: number) {
  return Math.trunc(n * 10000) / 10000
}

export async function geocodeNorwayAddress(
  address: string,
): Promise<{ latitude: string; longitude: string } | null> {
  const url = `${KARTVERKET_URL}?sok=${encodeURIComponent(address)}&treffPerSide=1`
  let res: Response
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } })
  } catch (err) {
    console.warn("[geocode] network error:", err)
    return null
  }
  if (!res.ok) {
    console.warn(`[geocode] ${String(res.status)} for "${address}"`)
    return null
  }
  const body = (await res.json()) as KartverketResponse
  const point = body.adresser?.[0]?.representasjonspunkt
  if (
    !point ||
    typeof point.lat !== "number" ||
    typeof point.lon !== "number"
  ) {
    return null
  }
  return {
    latitude: truncate4(point.lat).toFixed(4),
    longitude: truncate4(point.lon).toFixed(4),
  }
}
