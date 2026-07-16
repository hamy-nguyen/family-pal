import { NextResponse } from "next/server";
import type { StructuredResult } from "@/lib/types";

// Structuring step: OCR text + document photos -> a full structured record
// (medical record fields + drug list + supplement list + paraclinical results).
// Runs on local LM Studio (MLX) with an enforced JSON schema. Distinguishes
// prescriptions (đơn thuốc = drugs) from supplements (phiếu tư vấn = NOT drugs).

const LMSTUDIO_URL = process.env.LMSTUDIO_URL ?? "http://localhost:1234/v1";
const STRUCTURE_MODEL = process.env.STRUCTURE_MODEL ?? "gemma-4-e4b-it";

const med = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    strength: { type: "string" },
    quantity: { type: "string" },
    unit: { type: "string" },
    usage: { type: "string" },
  },
  required: ["name", "strength", "quantity", "unit", "usage"],
};
const supp = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    quantity: { type: "string" },
    usage: { type: "string" },
  },
  required: ["name", "quantity", "usage"],
};
const inv = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: {
      type: "string",
      enum: ["ultrasound", "xray", "ct", "mri", "endoscopy", "blood", "urine", "stool", "culture", "ecg", "other"],
    },
    title: { type: "string" },
    conclusion: { type: "string" },
    findings: { type: "string" },
  },
  required: ["type", "title", "conclusion", "findings"],
};

const JSON_SCHEMA = {
  name: "medical_visit",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      diagnosis: { type: "string" },
      clinic_location: { type: "string" },
      visit_date: { type: "string" }, // YYYY-MM-DD
      disease_process: { type: "string" },
      doctor: { type: "string" },
      icd_code: { type: "string" },
      treatment_note: { type: "string" },
      consultation_fee: { type: "string" },
      medication_fee: { type: "string" },
      insurance: { type: "string" },
      medications: { type: "array", items: med },
      supplements: { type: "array", items: supp },
      investigations: { type: "array", items: inv },
    },
    required: [
      "diagnosis", "clinic_location", "visit_date", "disease_process", "doctor",
      "icd_code", "treatment_note", "consultation_fee", "medication_fee",
      "insurance", "medications", "supplements", "investigations",
    ],
  },
};

const PROMPT = `Bạn trích xuất dữ liệu từ các giấy tờ y tế Việt Nam (phiếu khám bệnh, đơn thuốc,
kết quả cận lâm sàng như siêu âm/nội soi/xét nghiệm máu/nước tiểu/phân). Bạn nhận
được văn bản OCR và ảnh gốc. CHỈ điền thông tin THỰC SỰ có trên giấy tờ; nếu không
thấy để "" hoặc mảng rỗng. TUYỆT ĐỐI không bịa. Giữ nguyên tiếng Việt.

Trích xuất:
- diagnosis: chẩn đoán chính (ví dụ "Viêm dạ dày trào ngược")
- clinic_location: nơi khám / bệnh viện
- visit_date: ngày khám dạng YYYY-MM-DD
- disease_process: quá trình bệnh lý / diễn tiến
- doctor: bác sĩ khám
- icd_code: mã ICD-10 nếu có (ví dụ K21, N30)
- treatment_note: hướng xử trí / điều trị
- consultation_fee / medication_fee / insurance: chi phí nếu có
- medications: THUỐC trong đơn thuốc (name, strength=hàm lượng, quantity=số lượng,
  unit=đvt, usage=cách dùng)
- supplements: sản phẩm trong "phiếu tư vấn" / thực phẩm hỗ trợ (KHÔNG phải thuốc)
- investigations: kết quả cận lâm sàng (type, title, conclusion=kết luận,
  findings=mô tả). type thuộc: ultrasound,xray,ct,mri,endoscopy,blood,urine,stool,culture,ecg,other.

Văn bản OCR:

`;

const EMPTY: StructuredResult = {
  diagnosis: "", clinic_location: "", visit_date: "", disease_process: "",
  doctor: "", icd_code: "", treatment_note: "",
  consultation_fee: "", medication_fee: "", insurance: "",
  medications: [], supplements: [], investigations: [],
};

export async function POST(req: Request) {
  const { text, images } = await req.json();
  const imgs: string[] = (images ?? []).filter(Boolean);
  try {
    const content: unknown[] = [{ type: "text", text: PROMPT + (text ?? "") }];
    for (const img of imgs) content.push({ type: "image_url", image_url: { url: img } });

    const r = await fetch(`${LMSTUDIO_URL}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: STRUCTURE_MODEL,
        messages: [{ role: "user", content }],
        response_format: { type: "json_schema", json_schema: JSON_SCHEMA },
        temperature: 0.2,
        stream: false,
      }),
      signal: AbortSignal.timeout(180000),
    });
    if (!r.ok) throw new Error(`LM Studio ${r.status}: ${await r.text()}`);
    const data = await r.json();
    return NextResponse.json(JSON.parse(data.choices[0].message.content));
  } catch (e) {
    console.warn("structure failed, empty draft:", e);
    return NextResponse.json(EMPTY);
  }
}
