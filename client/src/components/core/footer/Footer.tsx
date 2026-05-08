import Navigation from "@/components/shared/Navigation"
import ContactsSummary from "@/features/dashboard/contactssummary/ContactsSummary.tsx"

export default function Footer() {
  return (
    <footer style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <h1>Footer</h1>
        <Navigation />
      </div>
      <ContactsSummary />
    </footer>
  )
}
