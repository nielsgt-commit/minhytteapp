import { UnauthenticatedView } from "./UnauthenticatedView"
import { HomeLayout } from "./HomeLayout"

export function Home() {
  return (
    <HomeLayout>
      <UnauthenticatedView />
    </HomeLayout>
  )
}
