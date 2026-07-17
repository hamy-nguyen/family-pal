-- =============================================================================
-- Family Pal — Supabase/Postgres schema
--
-- Model: caregiver + profiles, with a HOUSEHOLD layer so co-management (inviting
-- a second caregiver) is a future data operation, not a migration.
--
--   auth.users ─< household_members >─ households ─< profiles ─< visits
--                                                                  │
--   a visit (one consultation) contains:                          ├─< medications    (drugs — đơn thuốc)
--     • the medical record (fields below)                         ├─< supplements    (phiếu tư vấn — NOT drugs)
--     • paraclinical results (ultrasound/blood/stool/…)           ├─< investigations (cận lâm sàng)
--     • prescriptions (drugs) + supplements                       └─< attachments    (document photos)
--
-- Images live in Cloudflare R2 (URLs stored here), not Supabase Storage.
--
-- ⚠️ SECURITY: POC uses the public anon key + permissive membership policies via
-- auth.uid(). Add real auth flows (magic link) before going public. RLS is scoped
-- so a user only ever sees households they belong to.
-- =============================================================================

-- ---------- household + people ----------

create table if not exists households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'My Family',
  created_at timestamptz not null default now()
);

create table if not exists household_members (
  household_id uuid not null references households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'owner' check (role in ('owner','editor','viewer')),
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists idx_hm_user on household_members (user_id);
-- Caregiver display info, populated on signup / invite-accept, so the roster can
-- show who has access WITHOUT the client reading the protected auth.users table.
alter table household_members add column if not exists email text;
alter table household_members add column if not exists name  text;

create table if not exists profiles (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references households (id) on delete cascade,
  name               text not null,
  relationship       text not null default 'other'
                     check (relationship in
                       ('self','child','parent','spouse','sibling','grandparent','other')),
  date_of_birth      date,
  sex                text check (sex in ('male','female','other')),
  color_index        int not null default 0,
  blood_type         text,
  allergies          text,
  chronic_conditions text,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_profiles_household on profiles (household_id);

-- ---------- the visit (medical record) ----------

create table if not exists visits (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references households (id) on delete cascade,
  profile_id         uuid not null references profiles (id) on delete cascade,
  created_by         uuid references auth.users (id) on delete set null,

  -- required
  visit_date         date,                       -- Ngày khám
  clinic_location    text not null default '',   -- Nơi khám / bệnh viện
  diagnosis          text not null default '',   -- Chẩn đoán (card title)
  disease_process    text not null default '',   -- Quá trình bệnh lý / diễn tiến
  -- optional
  doctor             text not null default '',   -- Bác sĩ khám
  icd_code           text not null default '',   -- Mã ICD-10 (e.g. N30, K21)
  treatment_note     text not null default '',   -- Hướng xử trí / điều trị
  treatment_location text not null default '',   -- Nơi điều trị (e.g. tại nhà)
  follow_up_date     date,                       -- Hẹn tái khám
  vitals             jsonb not null default '{}',-- {pulse,temp_c,bp,resp,spo2,weight_kg,height_cm,bmi}
  consultation_fee   text not null default '',   -- Tiền khám
  medication_fee     text not null default '',   -- Tiền thuốc
  insurance          text not null default '',   -- Bảo hiểm chi trả
  note               text not null default '',   -- ghi chú tự do (optional)

  raw_text           text,                       -- combined OCR audit
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_visits_household on visits (household_id);
create index if not exists idx_visits_profile   on visits (profile_id);
create index if not exists idx_visits_created    on visits (created_at desc);
create index if not exists idx_visits_diagnosis  on visits (lower(diagnosis));
create index if not exists idx_visits_search on visits
  using gin (to_tsvector('simple',
    coalesce(diagnosis,'') || ' ' || coalesce(clinic_location,'') || ' ' ||
    coalesce(disease_process,'') || ' ' || coalesce(icd_code,'')));

-- ---------- prescriptions: drugs ----------
create table if not exists medications (
  id        uuid primary key default gen_random_uuid(),
  visit_id  uuid not null references visits (id) on delete cascade,
  name      text not null,
  strength  text not null default '',   -- Hàm lượng (e.g. 500mg)
  quantity  text not null default '',   -- Số lượng
  unit      text not null default '',   -- ĐVT (viên/gói/lọ/ống)
  usage     text not null default '',   -- Cách dùng
  notes     text not null default '',
  position  int  not null default 0
);
create index if not exists idx_meds_visit on medications (visit_id);
create index if not exists idx_meds_name   on medications (lower(name));

-- ---------- supplements / support products (phiếu tư vấn — NOT drugs) ----------
create table if not exists supplements (
  id        uuid primary key default gen_random_uuid(),
  visit_id  uuid not null references visits (id) on delete cascade,
  name      text not null,
  quantity  text not null default '',
  usage     text not null default '',
  notes     text not null default '',
  position  int  not null default 0
);
create index if not exists idx_supp_visit on supplements (visit_id);

-- ---------- paraclinical results (cận lâm sàng) ----------
create table if not exists investigations (
  id            uuid primary key default gen_random_uuid(),
  visit_id      uuid not null references visits (id) on delete cascade,
  type          text not null default 'other'
                check (type in ('ultrasound','xray','ct','mri','endoscopy',
                                'blood','urine','stool','culture','ecg','other')),
  title         text not null default '',   -- e.g. "Siêu âm ổ bụng"
  conclusion    text not null default '',   -- Kết luận (the searchable finding)
  findings      text not null default '',   -- Mô tả / kết quả (long)
  result_values jsonb,                       -- optional structured lab values
  image_url     text,                        -- result document (R2)
  performed_at  date,
  position      int not null default 0
);
create index if not exists idx_inv_visit on investigations (visit_id);
create index if not exists idx_inv_type   on investigations (type);

-- ---------- attachments: any document photo, typed ----------
create table if not exists attachments (
  id        uuid primary key default gen_random_uuid(),
  visit_id  uuid not null references visits (id) on delete cascade,
  kind      text not null default 'other'
            check (kind in ('prescription','exam_result','investigation',
                            'record','supplement_slip','other')),
  image_url text not null,
  caption   text not null default '',
  position  int  not null default 0
);
create index if not exists idx_att_visit on attachments (visit_id);

-- ---------- invitations (co-management path) ----------
create table if not exists invitations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  email        text not null,
  role         text not null default 'editor' check (role in ('owner','editor','viewer')),
  token        uuid not null default gen_random_uuid(),
  status       text not null default 'pending'
               check (status in ('pending','accepted','revoked','expired')),
  invited_by   uuid references auth.users (id) on delete set null,
  accepted_by  uuid references auth.users (id) on delete set null,
  accepted_at  timestamptz,
  expires_at   timestamptz not null default (now() + interval '14 days'),
  created_at   timestamptz not null default now()
);
create index if not exists idx_inv_token on invitations (token);
create index if not exists idx_inv_email on invitations (lower(email));

-- ---------- helper functions (SECURITY DEFINER avoids RLS recursion) ----------
create or replace function auth_household_ids()
returns setof uuid language sql security definer stable set search_path = public as $$
  select household_id from household_members where user_id = auth.uid()
$$;

create or replace function auth_household_role(hid uuid)
returns text language sql security definer stable set search_path = public as $$
  select coalesce((select role from household_members
    where household_id = hid and user_id = auth.uid()), '')
$$;

-- household that owns a visit — lets child-table policies reuse the role check.
create or replace function visit_household(vid uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select household_id from visits where id = vid
$$;

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_profiles_updated on profiles;
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();
drop trigger if exists trg_visits_updated on visits;
create trigger trg_visits_updated before update on visits
  for each row execute function set_updated_at();

-- Auto-create a household (user = owner) on signup.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  insert into households default values returning id into hid;
  insert into household_members (household_id, user_id, role, email, name)
    values (hid, new.id, 'owner', new.email, split_part(new.email, '@', 1));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

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

-- Read an invitation BEFORE the invitee is a member (RLS would otherwise hide it).
-- SECURITY DEFINER: returns only the role + household name for a valid token.
create or replace function invitation_preview(invite_token uuid)
returns table (role text, household_name text)
language sql security definer stable set search_path = public as $$
  select i.role, h.name
  from invitations i join households h on h.id = i.household_id
  where i.token = invite_token and i.status = 'pending'
$$;

-- Atomic visit write: the visit row + all its child rows in ONE transaction, so a
-- half-saved record can't exist. Role is checked here too (owner/editor only).
-- `p` is the whole visit as JSON (same shape the client already builds).
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

-- Atomic visit update: replace the visit's fields and rewrite its children.
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

-- ---------- Row Level Security ----------
alter table households        enable row level security;
alter table household_members enable row level security;
alter table profiles          enable row level security;
alter table visits            enable row level security;
alter table medications       enable row level security;
alter table supplements       enable row level security;
alter table investigations    enable row level security;
alter table attachments       enable row level security;
alter table invitations       enable row level security;

create policy hh_select on households for select using (id in (select auth_household_ids()));
create policy hh_insert on households for insert with check (auth.uid() is not null);
create policy hh_update on households for update using (auth_household_role(id) = 'owner');
create policy hh_delete on households for delete using (auth_household_role(id) = 'owner');

create policy hm_select on household_members for select using (household_id in (select auth_household_ids()));
create policy hm_insert on household_members for insert with check (auth_household_role(household_id) = 'owner');
create policy hm_update on household_members for update using (auth_household_role(household_id) = 'owner');
create policy hm_delete on household_members for delete using (auth_household_role(household_id) = 'owner');

create policy pr_select on profiles for select using (household_id in (select auth_household_ids()));
create policy pr_write on profiles for all
  using (auth_household_role(household_id) in ('owner','editor'))
  with check (auth_household_role(household_id) in ('owner','editor'));

create policy vs_select on visits for select using (household_id in (select auth_household_ids()));
create policy vs_write on visits for all
  using (auth_household_role(household_id) in ('owner','editor'))
  with check (auth_household_role(household_id) in ('owner','editor'));

-- child tables: readable by any household member, writable by owner/editor.
do $$
declare t text;
begin
  foreach t in array array['medications','supplements','investigations','attachments'] loop
    execute format($f$
      create policy %1$s_select on %1$s for select
        using (auth_household_role(visit_household(visit_id)) <> '');
      create policy %1$s_write on %1$s for all
        using (auth_household_role(visit_household(visit_id)) in ('owner','editor'))
        with check (auth_household_role(visit_household(visit_id)) in ('owner','editor'));
    $f$, t);
  end loop;
end $$;

create policy inv_select on invitations for select using (household_id in (select auth_household_ids()));
create policy inv_write on invitations for all
  using (auth_household_role(household_id) in ('owner','editor'))
  with check (auth_household_role(household_id) in ('owner','editor'));

-- ---------- Storage: document images (private bucket, per-household) ----------
-- Images live in Supabase Storage, not the 500MB Postgres DB. The object path is
-- `${household_id}/${uuid}.jpg`; policies below use that first path segment so a
-- caregiver can only touch their own household's images. Reads are via short-lived
-- signed URLs (the bucket is private — nothing is publicly reachable).
insert into storage.buckets (id, name, public)
values ('visit-images', 'visit-images', false)
on conflict (id) do nothing;

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
