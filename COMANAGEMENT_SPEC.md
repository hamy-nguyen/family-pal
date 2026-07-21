# Co-management — finalized spec v2 (ownership + grants)

Status: **finalized for implementation review.** Supersedes v1 (`claimed_by` / `move_profile`
/ "one home household" are **retired**). Model: a profile is *owned* by one principal and
*granted* to any number of others.

Adopted decisions: person-centric ownership + grants; a profile may be granted to
**multiple** households; **removal is non-destructive** (revoke grant, never force-delete);
signup offers **individual vs family**; "set up a family" also creates your self-profile;
your self-profile is **account-owned + granted** to the family.

---

## 1. Model

| Concept | Definition |
|---|---|
| **Account** | A login (`auth.users`). |
| **Household** | A family circle; accounts are **members** with a role. |
| **Profile** | A person's health record. **Owned by exactly one principal**: an *account* (self-managed) **or** a *household* (family-managed, for people with no login — baby, elderly). |
| **Grant** | Access to a profile given to a **household** (whole family sees it) or an **account** (e.g. a doctor), with a role. A profile can have **many** grants. |

**Ownership ≠ access.** Ownership = who the profile belongs to (can delete it, transfer it,
manage its grants). Access = who can currently see/edit it (owner + members of owner
household + grantees).

**Invariants**
- Every profile has **exactly one** owner (account XOR household).
- A grant targets **exactly one** grantee (household XOR account).
- Every household has **≥1 owner** (guards enforce).
- Deleting a profile happens **only** by explicit owner action or when the owning
  principal is deleted. Membership changes never delete profiles.

---

## 2. Signup / onboarding

No household is auto-created. The first screen after signup (unless arriving via an
invite) offers a **non-permanent** starting point:

| Choice | Creates |
|---|---|
| **Just me (individual)** | A **self-profile owned by your account**. No household. |
| **Set up a family** | A **household** (you = owner) **+ your self-profile** (account-owned, **granted** to the household). |
| **(Arrived via an invite)** | Joins the inviting household. No self-profile auto-created (avoids duplicating a pre-made one; they can add/claim later). |

Fluid later: an individual can create a family or accept an invite anytime; a family
owner can keep purely-personal profiles. `handle_new_user` (auto-household trigger) is
**removed**; onboarding does the creation.

---

## 3. Roles & permissions

**Household roles:** `owner` (a.k.a. co-owner, multiple allowed), `editor`, `viewer`.
**Grant roles:** `viewer`, `editor`.

| Capability | owner | editor | viewer |
|---|:--:|:--:|:--:|
| View granted/owned profiles & records | ✓ | ✓ | ✓ |
| Add/edit records & profiles | ✓ | ✓ | — |
| Invite members | ✓ (any role) | ✓ (editor/viewer) | — |
| Change roles / remove members / delete household | ✓ | — | — |
| **Grant a profile to another household/account** | its **owner** only | its owner only | — |
| **Transfer ownership** (graduation) | current owner (or an owner of the owning household) | — | — |

Managing a profile's **grants and ownership** is the **owner's** right (the owning account,
or an owner of the owning household). Household editors can edit *records* but not re-share
or give away a profile they don't own — this is the anti-exfiltration guard, now expressed
as "only the owner controls grants/ownership."

---

## 4. Access rule (one rule, drives RLS)

**View** profile P if any of:
- `P.owner_account_id = auth.uid()`, or
- you're a member of `P.owner_household_id`, or
- P is granted to a household you're a member of, or
- P is granted to your account (grant not expired).

**Edit** P if the above holds via a path whose role is owner/editor (owner account always;
household membership role owner/editor; grant role editor).

`visits` hang off `profile_id`; **`visits.household_id` is dropped** (a profile can live in
several households, so it's meaningless). Child tables (medications/…) resolve access
through their visit → profile.

---

## 5. Schema shape

```
profiles(
  id,
  owner_account_id   uuid null → auth.users(id)  on delete cascade,
  owner_household_id uuid null → households(id)   on delete cascade,
  CHECK (num_nonnulls(owner_account_id, owner_household_id) = 1),
  name, relationship, date_of_birth, sex, color_index, blood_type,
  allergies, chronic_conditions, notes, created_at, updated_at
)

profile_grants(
  id,
  profile_id            uuid → profiles(id) on delete cascade,
  grantee_household_id  uuid null → households(id) on delete cascade,
  grantee_account_id    uuid null → auth.users(id) on delete cascade,
  role  text check (role in ('viewer','editor')) default 'viewer',
  granted_by uuid, created_at, expires_at null,
  CHECK (num_nonnulls(grantee_household_id, grantee_account_id) = 1),
  UNIQUE (profile_id, grantee_household_id),
  UNIQUE (profile_id, grantee_account_id)
)

households, household_members, invitations  -- unchanged
visits            -- DROP household_id; keep profile_id
```

Helpers: `auth_can_view_profile(pid) bool`, `auth_can_edit_profile(pid) bool` (SECURITY
DEFINER, encode §4). All profile/visit/child RLS + `save_visit`/`update_visit` role checks
switch to these.

---

## 6. Flows

- **Individual signup** → self-profile (account-owned). Start recording.
- **Family signup** → household + self-profile (account-owned, granted to household).
- **Create a family later** (individual) → create household (owner) → grant your self-profile to it.
- **Invite → accept** → become a member; then optionally **grant your own self-profile** to
  the family so your records appear (this is "reconciliation," now just a grant).
- **Merge** (Mom pre-made a "Dad") → reassign the pre-made profile's visits onto Dad's
  account-owned profile, delete the pre-made one, keep the grant. (Manual demographic dedup.)
- **Graduation** (kid grows up) → **transfer ownership** household → kid's account; keep the
  family grant (share-back) or revoke it.
- **Leave / remove** → drop membership + **revoke that member's owned-profile grants** to the
  household. Household-owned profiles stay. **Nothing deleted.**
- **Multi-family** → grant a profile to several households; each sees it; revoking one
  doesn't affect the others.
- **Doctor / teacher** → grant the profile to their **account** (viewer, with expiry). Same table.

---

## 7. Edge cases

**Ownership / grants**
- Grant to a household you're not a member of → only the profile's owner can grant, and
  they grant to households they can reach; granting is an owner action.
- Duplicate grant (same profile→same household) → blocked by UNIQUE; treated as "already shared."
- Transfer ownership to an account → that account must exist (invite them first if new).
- Delete a profile → owner-only; cascades its visits + grants.

**Membership**
- Last owner leaving/demoted with others present → blocked; transfer ownership first.
- Remove/leave revokes only the *leaving member's* owned-profile grants; profiles they
  merely *edited* (owned by others/household) are untouched.
- Individual user (no household) → "active household" is a first-class **null** state; the
  app shows "Your records," not a family book. `getSession` must not treat null-household as
  an error.
- Brand-new invitee → joins the family; no phantom household created.

**Reconciliation / graduation**
- Viewer-role member → can be granted access but can't grant/transfer (owner-only actions).
- Graduating a household-owned profile requires an owner of the owning household to transfer it.
- Merge loses the pre-made profile's demographic fields (visits move, profile dropped) — manual cleanup.

**Storage (resolved: Option 2)**
- Images keyed by `profile_id` (`{profile_id}/{uuid}.jpg`); storage RLS authorizes via
  `auth_can_view_profile`. Moves/grants "just work"; **existing `{household_id}/…` objects
  need a one-time re-key migration**, and `uploadImage` must know the profile at upload time.

**System**
- Deleting a household → cascades household-owned profiles + memberships + grants *to* it;
  account-owned profiles granted to it just lose that grant (survive).
- Account deletion → cascades account-owned profiles + memberships + grants; household-owned
  profiles survive (they belong to the family).

---

## 8. What changed from v1 (retired)
- `claimed_by`, `move_profile`, `set_profile_claim`, `discard_household_if_empty`, "one home
  household," and the delete-on-removal trigger are **all gone**.
- Replaced by: `owner_account_id`/`owner_household_id`, `profile_grants`, ownership transfer,
  and grant revoke-on-removal (non-destructive).
- `migrate_comanagement.sql` (v1) will be **replaced** by a v2 migration.

## 9. Next steps
1. Rewrite the migration + `schema.sql` around §5 (owner + grants, drop `visits.household_id`,
   new RLS, profile-keyed storage, remove auto-household trigger).
2. Rewrite the data layer (`Repo`/`Auth`) + onboarding choice + grant/transfer/leave UI.
3. Ship in order: ownership+grants foundation → onboarding → invite/grant/graduation UI.
