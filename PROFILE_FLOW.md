# Profile Management — Flow & Cases

The finalized **ownership + grants** model. A profile is **owned by exactly one** principal
(an account *or* a household) and **granted** to any number of households/accounts.

---

## 1. The model — ownership vs. access

```mermaid
flowchart LR
  Acc([Account])
  HH([Household])
  Pr[Profile]

  Acc -- "member: owner / editor / viewer" --> HH
  Acc == "OWNS — self-managed (individual)" ==> Pr
  HH == "OWNS — family-managed (baby / elderly)" ==> Pr
  Pr -. "grant: viewer / editor" .-> HH
  Pr -. "grant: viewer / editor" .-> Acc
```

- **Ownership** (`== bold ==`): exactly one — an account **or** a household.
- **Grants** (`-. dotted .->`): zero-to-many — to whole households (family book) or single accounts (a doctor).
- **You can see a profile if:** you own it · you're a member of its owner-household · it's granted to a household you're in · it's granted to your account. *Edit* if that path is owner/editor.

---

## 2. Sign-up → first profile

```mermaid
flowchart TD
  S([New account]) --> Inv{Arrived via an invite link?}

  Inv -- "Yes" --> J[Join that household as a member]
  J --> Recon["Optional: grant your OWN profile<br/>to the family — reconciliation"]

  Inv -- "No" --> Setup[Set up your own profile]
  Setup --> Q{How will you use it?}
  Q -- "Just me" --> Solo["Account-owned self-profile<br/>(no household)"]
  Q -- "My family" --> Fam["Create household + self-profile<br/>(account-owned, granted to household)"]
  Fam --> Add["Add family members<br/>(household-owned profiles)"]
```

---

## 3. Profile lifecycle — every management case

```mermaid
flowchart TD
  Create{{Create a profile}}
  Create -- "your own (individual)" --> AO[["Account-owned"]]
  Create -- "a family member" --> HO[["Household-owned"]]

  %% grants (reconciliation, multi-family, clinician)
  AO -- "grant to household(s)" --> Book["Appears in that family book<br/>(grant to many = multi-family)"]
  HO -- "grant to household(s)" --> Book
  AO -- "grant to an account" --> Doc["Shared with a doctor/teacher<br/>(viewer, optional expiry)"]
  HO -- "grant to an account" --> Doc

  %% ownership transfers
  HO -- "graduation: hand to the person" --> AO
  AO -- "adoption: hand to a household" --> HO

  %% removal is non-destructive
  Book -- "leave / remove a member" --> Revoke["Revoke that household's grant<br/>records survive with the owner"]

  %% explicit delete is the only destruction
  AO -- "owner deletes" --> Del[(Deleted — records erased)]
  HO -- "owner deletes" --> Del
```

---

## 4. Case → mechanism (nothing left out)

| Case | Mechanism |
|---|---|
| Use the app individually | **Account-owned** self-profile, no household |
| Track a family | **Household-owned** member profiles |
| Your own health in the family book | Account-owned + **grant to the household** |
| Someone joins your family (reconciliation) | They **grant** their profile to your household |
| A person in two families (multi-family) | **Grant to multiple households** — same record, both see it |
| Share one person with a doctor/teacher | **Grant to an account** (viewer, expiry) |
| Child grows up (graduation) | **Transfer ownership**: household → their account; keep/drop the family grant |
| A no-login person gains a login (adoption reverse) | **Transfer ownership**: account ↔ household |
| Member leaves or is removed | **Revoke** their owned-profile grants — *non-destructive*, nothing deleted |
| Erase a person's records | **Delete profile** (owner/editor) — hard delete, cascades visits |

---

## 5. Rules baked in

- **Exactly one owner** per profile; **many grants**.
- **Only the owner** manages a profile's grants and ownership (anti-exfiltration).
- **Removal ≠ deletion** — leaving/removing a member only revokes grants; records leave with their owner. Deletion is a separate, explicit, owner action.
- Every household keeps **≥ 1 owner** (guards block orphaning).
