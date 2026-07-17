-- =============================================================================
-- Phase 2 catch-up migration — run this in the Supabase SQL editor.
--
-- Fixes: POST /rest/v1/rpc/save_visit -> 404 (the RPCs weren't in the DB because
-- schema.sql was run before they were added). Fully IDEMPOTENT — safe to run on
-- any prior state (won't error on existing tables/policies like re-running the
-- whole schema.sql would). Assumes the base tables from schema.sql already exist.
-- =============================================================================

-- ---------- household_members: caregiver display columns ----------
alter table household_members add column if not exists email text;
alter table household_members add column if not exists name  text;

-- backfill email/name for members created before these columns existed
update household_members m
set email = u.email,
    name  = coalesce(m.name, split_part(u.email, '@', 1))
from auth.users u
where u.id = m.user_id and (m.email is null or m.email = '');

-- ---------- triggers/helpers that now populate email/name ----------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  insert into households default values returning id into hid;
  insert into household_members (household_id, user_id, role, email, name)
    values (hid, new.id, 'owner', new.email, split_part(new.email, '@', 1));
  return new;
end $$;

create or replace function accept_invitation(invite_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv invitations; uemail text;
begin
  select email into uemail from auth.users where id = auth.uid();
  select * into inv from invitations where token = invite_token and status = 'pending';
  if inv.id is null then raise exception 'invalid or already-used invitation'; end if;
  if inv.expires_at < now() then
    update invitations set status = 'expired' where id = inv.id;
    raise exception 'invitation expired';
  end if;
  insert into household_members (household_id, user_id, role, email, name)
    values (inv.household_id, auth.uid(), inv.role, uemail, split_part(uemail, '@', 1))
    on conflict (household_id, user_id) do nothing;
  update invitations set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
    where id = inv.id;
  return inv.household_id;
end $$;

-- ---------- the RPCs the client calls ----------
create or replace function invitation_preview(invite_token uuid)
returns table (role text, household_name text)
language sql security definer stable set search_path = public as $$
  select i.role, h.name
  from invitations i join households h on h.id = i.household_id
  where i.token = invite_token and i.status = 'pending'
$$;

create or replace function save_visit(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare vid uuid; hid uuid; item jsonb;
begin
  select household_id into hid from profiles where id = (p->>'profile_id')::uuid;
  if hid is null then raise exception 'profile not found'; end if;
  if auth_household_role(hid) not in ('owner','editor') then raise exception 'not permitted'; end if;

  insert into visits (household_id, profile_id, created_by, visit_date, clinic_location, diagnosis,
    disease_process, doctor, icd_code, treatment_note, treatment_location, follow_up_date, vitals,
    consultation_fee, medication_fee, insurance, note, raw_text)
  values (hid, (p->>'profile_id')::uuid, auth.uid(),
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
declare vid uuid; hid uuid; item jsonb;
begin
  vid := (p->>'id')::uuid;
  select household_id into hid from visits where id = vid;
  if hid is null then raise exception 'visit not found'; end if;
  if auth_household_role(hid) not in ('owner','editor') then raise exception 'not permitted'; end if;

  update visits set
    profile_id = (p->>'profile_id')::uuid,
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

-- ---------- Storage bucket + per-household policies (idempotent) ----------
insert into storage.buckets (id, name, public)
values ('visit-images', 'visit-images', false)
on conflict (id) do nothing;

drop policy if exists "visit_images_read"   on storage.objects;
drop policy if exists "visit_images_write"  on storage.objects;
drop policy if exists "visit_images_delete" on storage.objects;

create policy "visit_images_read" on storage.objects for select using (
  bucket_id = 'visit-images'
  and (storage.foldername(name))[1] in (
    select household_id::text from household_members where user_id = auth.uid()
  )
);
create policy "visit_images_write" on storage.objects for insert with check (
  bucket_id = 'visit-images'
  and (storage.foldername(name))[1] in (
    select household_id::text from household_members
    where user_id = auth.uid() and role in ('owner','editor')
  )
);
create policy "visit_images_delete" on storage.objects for delete using (
  bucket_id = 'visit-images'
  and (storage.foldername(name))[1] in (
    select household_id::text from household_members
    where user_id = auth.uid() and role in ('owner','editor')
  )
);

-- ---------- audit FKs -> on delete set null (so deleting a user works) ----------
-- Without this, deleting an auth user who created a visit / sent an invite fails
-- with "Database error deleting user" (the FK blocks it).
alter table visits      drop constraint if exists visits_created_by_fkey;
alter table visits      add  constraint visits_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table invitations drop constraint if exists invitations_invited_by_fkey;
alter table invitations add  constraint invitations_invited_by_fkey
  foreign key (invited_by) references auth.users(id) on delete set null;

alter table invitations drop constraint if exists invitations_accepted_by_fkey;
alter table invitations add  constraint invitations_accepted_by_fkey
  foreign key (accepted_by) references auth.users(id) on delete set null;

-- ---------- nudge PostgREST to reload its schema cache ----------
notify pgrst, 'reload schema';
