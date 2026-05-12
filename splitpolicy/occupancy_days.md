# Split policy: `occupancy_days`

**Goal:** divide the total reimbursed expenses across owner groups in proportion to how many **person-nights** each group occupied the property during the settlement window.

## Inputs (`server/src/trpc/routers/settlement.ts:205-358`)

- **Main groups** — distinct owner groups for the property where `is_main = true`. Members of those groups are mapped user → group.
- **Total reimbursed** — sum of `amount` over expenses on this settlement with `status = "reimbursed"`. Each expense's `reimbursed_by_id` attributes the paid amount to that user's group → `paidByGroup`.
- **Eligible bookings** — every booking on the property *except* cancelled ones and any flagged `excluded` via `settlement_booking_adjustments`.

## Per-group days (`settlement.ts:339-358`)

For each eligible booking:

1. `days = inclusiveDayCount(start_date, end_date)`.
2. For every occupant in `booking_occupants`, add `days` to that occupant's group.
3. If the adjustment row has `extra_names` (non-member guests the booker brought), add `extras.length * days` to the **booker's** group.

So each group's `booking_days` is really *person-days* occupied by its members (+ extras attributed to the booker).

## Share computation (`settlement.ts:361-387`)

```
share_g = round(days_g * total_reimbursed / total_days)
net_g   = paid_g - share_g
```

Rounding drift (`total_reimbursed - Σ share_g`) is absorbed by the group with the most days, so the totals reconcile to the cent.

## Transfers (`computeTransfers`, settlement.ts:~170-203)

Groups with `net > 0` are creditors, `net < 0` are debtors. The algorithm walks paired lists and emits "from → to" transfers until everyone is square — that's what the "Transfers" section in the card renders.

## Acceptance & closing (`settlement.ts:389-409` and the component)

- `heads` = listed property heads; each has `accepted: true` if there's a row in `settlement_acceptances`.
- The UI's **Accept and close** button calls `acceptSplit`. Once all heads accept, `phase` flips to `closed` and the card switches to the read-only state (`ReviewSplitPolicy.tsx:84, 170-173`).

## How the component renders this (`client/src/features/settlement/reviewsplitpolicy/ReviewSplitPolicy.tsx`)

- `inputs.total_reimbursed` / `inputs.total_booking_days` → the headline numbers shown at the top.
- `groups[]` → the Per-group table (Days, Paid, Share, Net).
- `transfers[]` → settlement instructions ("X pays Y").
- `heads[]` → acceptance roster; only heads can accept (line 211).
- The error branch (line 65) confirms `occupancy_days` is currently the **only** implemented policy — the other enum values (`shares`, `groups_equal`) throw `NOT_IMPLEMENTED` from `previewSplit`.

## One-line summary

`total_reimbursed × (group's person-nights / total person-nights)`, rounded with drift absorbed by the largest occupier; netted against what each group actually paid; surplus groups receive from deficit groups via the transfers list.
