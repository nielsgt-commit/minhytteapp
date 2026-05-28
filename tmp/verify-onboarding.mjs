// One-off verification script. Drives the onboarding redirect end-to-end:
//   1. Trigger magic-link send via the API.
//   2. Read the verification token from the DB.
//   3. Open a browser, hit the magic-link callback URL → session cookie set.
//   4. Navigate to /dashboard → expect _authed.beforeLoad to redirect to /onboarding.
//   5. Screenshot + report the final URL and the rendered welcome heading.

import { chromium } from "playwright"
import pg from "pg"
import dotenv from "dotenv"

dotenv.config({ path: ".env.development" })

const BASE = "http://localhost:5173"
const EMAIL = "weather@minhytte.app"
const CALLBACK = "/dashboard"

async function main() {
  console.log("1. POST /api/auth/sign-in/magic-link …")
  const r = await fetch(`${BASE}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, callbackURL: CALLBACK }),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`magic-link request failed ${r.status}: ${t}`)
  }
  console.log("   →", r.status, await r.text())

  console.log("2. read freshest verification row from DB …")
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await c.connect()
  const { rows } = await c.query(
    `SELECT id, identifier, value, expires_at, created_at
     FROM verifications
     ORDER BY created_at DESC
     LIMIT 1`,
  )
  await c.end()
  if (rows.length === 0) throw new Error("no verifications row found")
  const v = rows[0]
  console.log("   →", v)

  // better-auth magic link callback URL: /api/auth/magic-link/verify?token=<token>&callbackURL=<callback>
  const callbackUrl = encodeURIComponent(`${BASE}${CALLBACK}`)
  const magicLinkUrl = `${BASE}/api/auth/magic-link/verify?token=${v.value}&callbackURL=${callbackUrl}`
  console.log("3. magic link →", magicLinkUrl)

  console.log("4. launching browser …")
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  page.on("console", msg => {
    console.log(`   [browser:${msg.type()}]`, msg.text())
  })

  console.log("5. visiting magic-link URL …")
  await page.goto(magicLinkUrl, { waitUntil: "networkidle" })
  console.log("   → ended at:", page.url())

  // Whatever page we land on after auth, force-navigate to /dashboard
  // so _authed.beforeLoad runs and (per the change) redirects to /onboarding.
  console.log("6. navigating to /dashboard …")
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" })
  await page.waitForTimeout(800)
  console.log("   → ended at:", page.url())

  // Pull visible heading text
  const headings = await page.$$eval("h1, h2, h3", els =>
    els.map(e => e.textContent?.trim()).filter(Boolean),
  )
  console.log("7. visible headings:", headings)

  // Pull cookie state for debugging
  const cookies = await ctx.cookies()
  console.log(
    "   cookies:",
    cookies.map(c => `${c.name}=${c.value.slice(0, 12)}…`),
  )

  // Look for the wizard's "Tell us about the property" legend (basics step)
  const basicsVisible = await page
    .locator("text=Tell us about the property")
    .isVisible()
    .catch(() => false)
  console.log("8. basics step visible:", basicsVisible)

  await page.screenshot({ path: "tmp/onboarding-screenshot.png", fullPage: true })
  console.log("9. screenshot → tmp/onboarding-screenshot.png")

  await browser.close()
}

main().catch(e => {
  console.error("FAIL:", e)
  process.exit(1)
})
