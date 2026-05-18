import { AuthenticatedView } from "./AuthenticatedView"
import { UnauthenticatedView } from "./UnauthenticatedView"
import { HomeLayout } from "./HomeLayout"
import { HomeAuthGate } from "./HomeAuthGate"

export function Home() {
  return (
    <HomeLayout>
      <HomeAuthGate
        authenticated={<AuthenticatedView />}
        unauthenticated={<UnauthenticatedView />}
      />
    </HomeLayout>
  )
}
