import dotenv from "dotenv"

// On Render the runtime env is injected directly; loading a committed
// .env.production template (which has empty placeholders) would silently
// mask missing-var errors. Render sets RENDER=true automatically.
if (!process.env.RENDER) {
  dotenv.config({
    path: `.env.${process.env.NODE_ENV ?? "development"}`,
  })
}
