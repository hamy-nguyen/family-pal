// Authorization — ONE source of truth for "who can do what". Screens and the
// mutation layer both ask can(role, capability); nobody hard-codes role checks.
// This mirrors the RLS in supabase/schema.sql so the mock and Phase 2 agree:
//   • owner/editor may write records + patient profiles
//   • owner alone controls the household (rename, membership, roles, invites)
//   • viewer is strictly read-only
import type { Role } from "./auth";

export type Capability =
  | "records:view"
  | "records:create"
  | "records:edit"
  | "records:delete"
  | "profiles:manage" // add/edit/delete the PATIENT profiles (family members)
  | "household:rename"
  | "members:manage"; // invite / change role / remove CAREGIVERS

const ROLE_CAPS: Record<Role, Capability[]> = {
  owner: [
    "records:view", "records:create", "records:edit", "records:delete",
    "profiles:manage", "household:rename", "members:manage",
  ],
  editor: [
    "records:view", "records:create", "records:edit", "records:delete",
    "profiles:manage",
  ],
  viewer: ["records:view"],
};

export function can(role: Role | null | undefined, cap: Capability): boolean {
  return !!role && ROLE_CAPS[role].includes(cap);
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  editor: "Can edit",
  viewer: "View only",
};
export const ROLE_DESC: Record<Role, string> = {
  owner: "Full access",
  editor: "Add & edit records",
  viewer: "Read-only",
};
