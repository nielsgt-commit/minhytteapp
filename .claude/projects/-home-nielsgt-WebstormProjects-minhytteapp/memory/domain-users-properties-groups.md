---
name: domain-users-properties-groups
description: Core domain model for users, properties, family groups, and the "head" role in minhytteapp
metadata:
  type: project
---

minhytteapp domain (clarified by the owner 2026-05-30):

- A **property** (shared cabin) is co-owned by **multiple families/households**. Each household = a `user_groups` row with `is_main = true`, linked via `user_groups.property_id`. A property can have **several** `is_main` groups — never assume one. (Do NOT add a "one main group per property" unique constraint; the real invariant is "a user is in ≤1 main group per property", enforced in app logic.)
- A user belongs to their **family (is_main) group per property**, plus optional **age-based groups** (`is_main=false`) that cross families.
- Users belong to **≥2 properties**, not necessarily the same ones.
- **"Head"** = head of a household AND the person who settles expenses for that property. It is **per-property** and **self-signed**. Stored on `user_group_members.is_head` (moved off `users` in migration 0065). "Head of property P" = head-flagged membership in an is_main group of P. See [[head-role-per-property-rework]].
- `is_main` filters in settlement code mean "is a family/owning group" (joined to `property_owners`), and the client finds "the main group containing user X" — i.e. one main group per user per property.
- **Ownership is GROUP-ONLY** (migration 0069): `property_owners` references `user_group_id` only — the old `user_id` column and the user/group XOR are gone. A family's `ownership_pct` is the sum of its members' shares. Creating a property auto-bootstraps an is_main family group (creator as head, 100%).
- **Priority weeks key on the family group**: `property_priority_weeks.user_group_id` (not a per-user owner row). The split-policy DSL rule `during_priority_week` carries `user_group_id` too. Invariant relied on: a user is in ≤1 is_main group per property.
