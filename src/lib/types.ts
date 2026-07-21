// Core data model. A "visit" is one consultation that contains the medical
// record fields plus child lists: medications (drugs), supplements (NOT drugs),
// investigations (paraclinical results), and attachments (document photos).
// Mirrors supabase/schema.sql. Content is Vietnamese; UI chrome is English.

export type Relationship =
  | "self"
  | "child"
  | "parent"
  | "spouse"
  | "sibling"
  | "grandparent"
  | "other";
export type Sex = "male" | "female" | "other";

export type Profile = {
  id: string;
  name: string;
  relationship: Relationship;
  date_of_birth?: string; // ISO yyyy-mm-dd
  sex?: Sex;
  color_index: number; // stable avatar color
  blood_type?: string;
  allergies?: string;
  chronic_conditions?: string;
  notes?: string;
  // Ownership (exactly one is set). Account-owned = self-managed (individual use);
  // household-owned = family-managed (baby/elderly with no login). See COMANAGEMENT_SPEC.md.
  owner_account_id?: string;
  owner_household_id?: string;
  created_at: string;
};

// A grant gives one household (whole family) OR one account (a doctor) access to a
// profile, viewer or editor. A profile can have many grants — this is how a person's
// records appear in several family books, or are shared with a clinician.
export type GrantRole = "viewer" | "editor";
export type ProfileGrant = {
  id: string;
  profile_id: string;
  grantee_household_id?: string;
  grantee_account_id?: string;
  grantee_household_name?: string; // denormalized for display
  role: GrantRole;
  created_at: string;
  expires_at?: string;
};

// ---- visit children ----
export type Medication = {
  id?: string;
  name: string;
  strength?: string; // hàm lượng (e.g. 500mg)
  quantity?: string; // số lượng
  unit?: string; // viên/gói/lọ/ống
  usage?: string; // cách dùng
  notes?: string;
};

// support products from "phiếu tư vấn" — explicitly NOT medications
export type Supplement = {
  id?: string;
  name: string;
  quantity?: string;
  usage?: string;
  notes?: string;
};

export type InvestigationType =
  | "ultrasound"
  | "xray"
  | "ct"
  | "mri"
  | "endoscopy"
  | "blood"
  | "urine"
  | "stool"
  | "culture"
  | "ecg"
  | "other";

export type Investigation = {
  id?: string;
  type: InvestigationType;
  title?: string; // e.g. "Siêu âm ổ bụng"
  conclusion?: string; // Kết luận (the searchable finding)
  findings?: string; // Mô tả / kết quả (long)
  image_url?: string; // result document photo
  performed_at?: string;
};

export type AttachmentKind =
  | "prescription"
  | "exam_result"
  | "investigation"
  | "record"
  | "supplement_slip"
  | "other";

export type Attachment = {
  id?: string;
  kind: AttachmentKind;
  image_url: string;
  caption?: string;
};

export type Vitals = {
  pulse?: string;
  temp_c?: string;
  bp?: string;
  resp?: string;
  spo2?: string;
  weight_kg?: string;
  height_cm?: string;
  bmi?: string;
};

// ---- the visit ----
export type Visit = {
  id: string;
  profile_id: string;
  profile_name?: string; // denormalized for display

  visit_date?: string; // ISO date — Ngày khám
  clinic_location: string; // Nơi khám (required)
  diagnosis: string; // Chẩn đoán (card title, required)
  disease_process: string; // Quá trình bệnh lý / diễn tiến (required)

  doctor?: string;
  icd_code?: string; // Mã ICD-10
  treatment_note?: string; // Hướng xử trí
  treatment_location?: string;
  follow_up_date?: string; // Hẹn tái khám
  vitals?: Vitals;
  consultation_fee?: string;
  medication_fee?: string;
  insurance?: string;

  note?: string; // free-text note (optional)

  medications: Medication[];
  supplements: Supplement[];
  investigations: Investigation[];
  attachments: Attachment[];

  raw_text?: string; // combined OCR audit
  created_at: string;
};

export type NewVisitInput = Omit<Visit, "id" | "profile_name" | "created_at">;

// What the AI extracts from the document photos (the review screen edits this).
export type StructuredResult = {
  diagnosis: string;
  clinic_location: string;
  visit_date: string;
  disease_process: string;
  doctor: string;
  icd_code: string;
  treatment_note: string;
  consultation_fee: string;
  medication_fee: string;
  insurance: string;
  medications: Medication[];
  supplements: Supplement[];
  investigations: Investigation[];
};
