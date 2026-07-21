-- =============================================================================
-- Family Pal — Co-management v2, Phase 1 (EXPAND): ownership + grants foundation.
-- Idempotent. Run in the Supabase SQL editor. Safe to re-run.
--
-- DESIGN: a profile is OWNED by one principal (an account XOR a household) and
-- GRANTED to any number of households/accounts. See COMANAGEMENT_SPEC.md.
--
-- THIS PHASE IS ADDITIVE / NON-BREAKING:
--   • adds owner_account_id / owner_household_id (+ backfills from household_id)
--   • adds profile_grants
--   • makes profiles.household_id / visits.household_id NULLABLE (account-owned
--     profiles have no household) but KEEPS them so the current app keeps working
--   • swaps profile/visit/child RLS to grant-aware helpers (backward compatible:
--     a member of a profile's owner-household still sees it exactly as before)
--   • routes save_visit/update_visit permission through auth_can_edit_profile
-- DEFERRED to a later CONTRACT migration (with the app rewrite):
--   • dropping household_id columns, removing handle_new_user auto-household,
--     re-keying storage by profile_id.
-- =============================================================================

-- ---- 1) profiles: dual owner (account XOR household), backfilled ----
alter table profiles add column if not exists owner_account_id   uuid references auth.users (id) on delete cascade;
alter table profiles add column if not exists owner_household_id uuid references households (id) on delete cascade;

-- Existing profiles are family-managed → owner is their current household.
update profiles set owner_household_id = household_id
  where owner_household_id is null and owner_account_id is null;

-- Account-owned profiles have no household, so household_id can no longer be NOT NULL.
alter table profiles alter column household_id drop not null;
alter table visits   alter column household_id drop not null;

-- Exactly one owner (safe now that every row is backfilled).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_one_owner') then
    alter table profiles add constraint profiles_one_owner
      check (num_nonnulls(owner_account_id, owner_household_id) = 1);
  end if;
end $$;
create index if not exists idx_profiles_owner_hh   on profiles (owner_household_id);
create index if not exists idx_profiles_owner_acct on profiles (owner_account_id);

-- Transition back-compat: the currently-deployed app inserts household_id but not
-- owner_*, and the new app will insert owner_* but not household_id. Default each
-- from the other on insert so BOTH produce a valid one-owner row and household_id
-- stays populated for the old app's `.eq('household_id', …)` queries.
create or replace function profiles_default_owner()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.owner_account_id is null and new.owner_household_id is null and new.household_id is not null then
    new.owner_household_id := new.household_id;
  end if;
  if new.household_id is null and new.owner_household_id is not null then
    new.household_id := new.owner_household_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_default_owner on profiles;
create trigger trg_profiles_default_owner before insert on profiles
  for each row execute function profiles_default_owner();

-- ---- 2) profile_grants: access to a profile for a household OR an account ----
create table if not exists profile_grants (
  id                   uuid primary key default gen_random_uuid(),
  profile_id           uuid not null references profiles (id) on delete cascade,
  grantee_household_id uuid references households (id) on delete cascade,
  grantee_account_id   uuid references auth.users (id) on delete cascade,
  role                 text not null default 'viewer' check (role in ('viewer','editor')),
  granted_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  expires_at           timestamptz,
  constraint pg_one_grantee check (num_nonnulls(grantee_household_id, grantee_account_id) = 1)
);
create unique index if not exists uq_grant_hh   on profile_grants (profile_id, grantee_household_id) where grantee_household_id is not null;
create unique index if not exists uq_grant_acct on profile_grants (profile_id, grantee_account_id)   where grantee_account_id   is not null;
create index if not exists idx_grant_profile on profile_grants (profile_id);
create index if not exists idx_grant_hh      on profile_grants (grantee_household_id);
create index if not exists idx_grant_acct    on profile_grants (grantee_account_id);

-- ---- 3) access helpers (SECURITY DEFINER — avoid RLS recursion) ----
-- View: owner account, OR member of owner household, OR granted (to your account or
-- a household you're in) and not expired.
create or replace function auth_can_view_profile(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles p where p.id = pid
      and (p.owner_account_id = auth.uid() or p.owner_household_id in (select auth_household_ids()))
  ) or exists (
    select 1 from profile_grants g where g.profile_id = pid
      and (g.expires_at is null or g.expires_at > now())
      and (g.grantee_account_id = auth.uid() or g.grantee_household_id in (select auth_household_ids()))
  )
$$;

-- Edit: owner account, OR owner/editor of owner household, OR an EDITOR grant reaching
-- you (your account, or a household where you are owner/editor).
create or replace function auth_can_edit_profile(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles p where p.id = pid
      and (p.owner_account_id = auth.uid() or auth_household_role(p.owner_household_id) in ('owner','editor'))
  ) or exists (
    select 1 from profile_grants g where g.profile_id = pid and g.role = 'editor'
      and (g.expires_at is null or g.expires_at > now())
      and (g.grantee_account_id = auth.uid() or auth_household_role(g.grantee_household_id) in ('owner','editor'))
  )
$$;

-- profile that owns a visit — lets child-table policies resolve access.
create or replace function visit_profile(vid uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select profile_id from visits where id = vid
$$;

-- ---- 4) RLS: switch profile/visit/child policies to the grant-aware helpers ----
drop policy if exists pr_select on profiles;
drop policy if exists pr_write  on profiles;
create policy pr_select on profiles for select using (auth_can_view_profile(id));
create policy pr_insert on profiles for insert with check (
  (owner_account_id = auth.uid())
  or (owner_household_id is not null and auth_household_role(owner_household_id) in ('owner','editor'))
);
create policy pr_update on profiles for update using (auth_can_edit_profile(id)) with check (auth_can_edit_profile(id));
create policy pr_delete on profiles for delete using (
  (owner_account_id = auth.uid())
  or (owner_household_id is not null and auth_household_role(owner_household_id) in ('owner','editor'))
);

drop policy if exists vs_select on visits;
drop policy if exists vs_write  on visits;
create policy vs_select on visits for select using (auth_can_view_profile(profile_id));
create policy vs_insert on visits for insert with check (auth_can_edit_profile(profile_id));
create policy vs_update on visits for update using (auth_can_edit_profile(profile_id)) with check (auth_can_edit_profile(profile_id));
create policy vs_delete on visits for delete using (auth_can_edit_profile(profile_id));

do $$ declare t text; begin
  foreach t in array array['medications','supplements','investigations','attachments'] loop
    execute format('drop policy if exists %1$s_select on %1$s;', t);
    execute format('drop policy if exists %1$s_write on %1$s;', t);
    execute format($f$
      create policy %1$s_select on %1$s for select using (auth_can_view_profile(visit_profile(visit_id)));
      create policy %1$s_write  on %1$s for all
        using (auth_can_edit_profile(visit_profile(visit_id)))
        with check (auth_can_edit_profile(visit_profile(visit_id)));
    $f$, t);
  end loop;
end $$;

-- profile_grants: visible with the profile; only the profile's OWNER manages grants.
alter table profile_grants enable row level security;
drop policy if exists pg_select on profile_grants;
drop policy if exists pg_write  on profile_grants;
create policy pg_select on profile_grants for select using (auth_can_view_profile(profile_id));
create policy pg_write  on profile_grants for all
  using (exists (select 1 from profiles p where p.id = profile_id
           and (p.owner_account_id = auth.uid() or auth_household_role(p.owner_household_id) = 'owner')))
  with check (exists (select 1 from profiles p where p.id = profile_id
           and (p.owner_account_id = auth.uid() or auth_household_role(p.owner_household_id) = 'owner')));

-- ---- 5) save_visit / update_visit: permission via auth_can_edit_profile ----
-- Only the permission source + the derived household_id change; the body is unchanged.
create or replace function save_visit(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare vid uuid; hid uuid; pid uuid; item jsonb;
begin
  pid := (p->>'profile_id')::uuid;
  if not exists (select 1 from profiles where id = pid) then raise exception 'profile not found'; end if;
  if not auth_can_edit_profile(pid) then raise exception 'not permitted'; end if;
  select owner_household_id into hid from profiles where id = pid;  -- may be NULL for account-owned

  insert into visits (household_id, profile_id, created_by, visit_date, clinic_location, diagnosis,
    disease_process, doctor, icd_code, treatment_note, treatment_location, follow_up_date, vitals,
    consultation_fee, medication_fee, insurance, note, raw_text)
  values (hid, pid, auth.uid(),
    nullif(p->>'visit_date','')::date, coalesce(p->>'clinic_location',''), coalesce(p->>'diagnosis',''),
    coalesce(p->>'disease_process',''), coalesce(p->>'doctor',''), coalesce(p->>'icd_code',''),
    coalesce(p->>'treatment_note',''), coalesce(p->>'treatment_location',''),
    nullif(p->>'follow_up_date','')::date, coalesce(p->'vitals','{}'::jsonb),
    coalesce(p->>'consultation_fee',''), coalesce(p->>'medication_fee',''),
    coalesce(p->>'insurance',''), coalesce(p->>'note',''), p->>'raw_text')
  returning id into vid;

  for item in select jsonb_array_elements(coalesce(p->'medications','[]'::jsonb)) loop
    insert into medications (visit_id, name, strength, quantity, unit, usage, notes)
    values (vid, coalesce(item->>'name',''), coalesce(item->>'strength',''), coalesce(item->>'quantity',''),
            coalesce(item->>'unit',''), coalesce(item->>'usage',''), coalesce(item->>'notes',''));
  end loop;
  for item in select jsonb_array_elements(coalesce(p->'supplements','[]'::jsonb)) loop
    insert into supplements (visit_id, name, quantity, usage, notes)
    values (vid, coalesce(item->>'name',''), coalesce(item->>'quantity',''),
            coalesce(item->>'usage',''), coalesce(item->>'notes',''));
  end loop;
  for item in select jsonb_array_elements(coalesce(p->'investigations','[]'::jsonb)) loop
    insert into investigations (visit_id, type, title, conclusion, findings, image_url, performed_at)
    values (vid, coalesce(item->>'type','other'), coalesce(item->>'title',''), coalesce(item->>'conclusion',''),
            coalesce(item->>'findings',''), item->>'image_url', nullif(item->>'performed_at','')::date);
  end loop;
  for item in select jsonb_array_elements(coalesce(p->'attachments','[]'::jsonb)) loop
    insert into attachments (visit_id, kind, image_url, caption)
    values (vid, coalesce(item->>'kind','other'), coalesce(item->>'image_url',''), coalesce(item->>'caption',''));
  end loop;

  return vid;
end $$;

create or replace function update_visit(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare vid uuid; pid uuid; item jsonb;
begin
  vid := (p->>'id')::uuid;
  pid := (p->>'profile_id')::uuid;
  if not exists (select 1 from visits where id = vid) then raise exception 'visit not found'; end if;
  if not auth_can_edit_profile(pid) then raise exception 'not permitted'; end if;

  update visits set
    profile_id = pid,
    household_id = (select owner_household_id from profiles where id = pid),
    visit_date = nullif(p->>'visit_date','')::date,
    clinic_location = coalesce(p->>'clinic_location',''),
    diagnosis = coalesce(p->>'diagnosis',''),
    disease_process = coalesce(p->>'disease_process',''),
    doctor = coalesce(p->>'doctor',''),
    icd_code = coalesce(p->>'icd_code',''),
    treatment_note = coalesce(p->>'treatment_note',''),
    treatment_location = coalesce(p->>'treatment_location',''),
    follow_up_date = nullif(p->>'follow_up_date','')::date,
    vitals = coalesce(p->'vitals','{}'::jsonb),
    consultation_fee = coalesce(p->>'consultation_fee',''),
    medication_fee = coalesce(p->>'medication_fee',''),
    insurance = coalesce(p->>'insurance',''),
    note = coalesce(p->>'note','')
  where id = vid;

  delete from medications    where visit_id = vid;
  delete from supplements    where visit_id = vid;
  delete from investigations where visit_id = vid;
  delete from attachments    where visit_id = vid;

  for item in select jsonb_array_elements(coalesce(p->'medications','[]'::jsonb)) loop
    insert into medications (visit_id, name, strength, quantity, unit, usage, notes)
    values (vid, coalesce(item->>'name',''), coalesce(item->>'strength',''), coalesce(item->>'quantity',''),
            coalesce(item->>'unit',''), coalesce(item->>'usage',''), coalesce(item->>'notes',''));
  end loop;
  for item in select jsonb_array_elements(coalesce(p->'supplements','[]'::jsonb)) loop
    insert into supplements (visit_id, name, quantity, usage, notes)
    values (vid, coalesce(item->>'name',''), coalesce(item->>'quantity',''),
            coalesce(item->>'usage',''), coalesce(item->>'notes',''));
  end loop;
  for item in select jsonb_array_elements(coalesce(p->'investigations','[]'::jsonb)) loop
    insert into investigations (visit_id, type, title, conclusion, findings, image_url, performed_at)
    values (vid, coalesce(item->>'type','other'), coalesce(item->>'title',''), coalesce(item->>'conclusion',''),
            coalesce(item->>'findings',''), item->>'image_url', nullif(item->>'performed_at','')::date);
  end loop;
  for item in select jsonb_array_elements(coalesce(p->'attachments','[]'::jsonb)) loop
    insert into attachments (visit_id, kind, image_url, caption)
    values (vid, coalesce(item->>'kind','other'), coalesce(item->>'image_url',''), coalesce(item->>'caption',''));
  end loop;

  return vid;
end $$;

notify pgrst, 'reload schema';
-- =============================================================================
-- Verify:
--   select column_name from information_schema.columns
--     where table_name='profiles' and column_name like 'owner_%';
--   select proname from pg_proc where proname in ('auth_can_view_profile','auth_can_edit_profile');
-- Existing family data is untouched and still visible (owner_household_id = old household).
-- =============================================================================
