import { NextResponse } from "next/server";

// OCR endpoint. Forwards the image to the self-hosted Apple Vision server
// (ocr-server/, set OCR_ENDPOINT). Falls back to SAMPLE text when the env var
// is unset so the app still demos without the Python server running.
// WHY keep the fallback: lets the Next app build/run independently of the OCR
// box being up — the contract ({ image } -> { text }) is the only coupling.

const SAMPLE = `CITY GENERAL HOSPITAL
Date: 2026-06-12
Patient seen by Dr. Lee

DIAGNOSIS: Acute upper respiratory tract infection

PRESCRIPTION:
1. Amoxicillin 500mg - 1 cap three times daily x 5 days
2. Paracetamol 500mg - 1 tab every 6 hours as needed
3. Loratadine 10mg - 1 tab once daily x 7 days`;

export async function POST(req: Request) {
  const endpoint = process.env.OCR_ENDPOINT;

  if (!endpoint) {
    await new Promise((r) => setTimeout(r, 600)); // exercise UI loading state
    return NextResponse.json({ text: SAMPLE });
  }

  const { image } = await req.json();
  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image }),
    });
    if (!r.ok) throw new Error(`OCR server ${r.status}`);
    const { text } = await r.json();
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json(
      { error: `OCR failed: ${(e as Error).message}` },
      { status: 502 }
    );
  }
}
