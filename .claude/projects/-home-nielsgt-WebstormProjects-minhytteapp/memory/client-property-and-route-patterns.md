---
name: client-property-and-route-patterns
description: How client code gets the current property, and the /administrer vs /manageproperty route layout
metadata:
  type: reference
---

minhytteapp client conventions:

- **Current property**: per-property components read `useSelectedPropertyId()` from `@/features/property/propertySlice` (returns `number | null`; existing code passes `selectedPropertyId ?? 0` to queries). This is the canonical way to scope a query/mutation to "the property the user is currently viewing."
- **Edit permission**: `useCanEdit(propertyId?)` (`@/hooks/useCanEdit`) returns `me.is_admin || head_property_ids.includes(propertyId ?? selectedPropertyId)`. Call sites that omit the arg auto-scope to the selected property.
- **Routes**: the canonical pages live under `/_authed/administrer/*` (Norwegian names, e.g. `fordelingspolicy`=split policy, `utgiftskategorier`=expense categories, `innstillinger`=settings). The `/_authed/manageproperty/*` routes are **localized redirect stubs** (`throw redirect({ to: "/administrer/..." })`) — they are per-property aliases, not separate implementations. A per-property page route is usually just `{ component: SomeComponent }` and the component reads `useSelectedPropertyId()` itself (see `fordelingspolicy.tsx`).
- Owner intent: everything property-related is per-property, not global. See [[domain-users-properties-groups]].
