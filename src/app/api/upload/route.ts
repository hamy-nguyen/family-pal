import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Uploads a (compressed) image to Cloudflare R2 and returns its public URL.
// WHY a server route: R2 credentials stay on the server (Vercel env), never in
// the browser. The browser POSTs a data URL; we decode + PutObject to R2.
// R2's zero-egress means serving these images later costs no bandwidth.

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const publicBase = process.env.R2_PUBLIC_URL; // e.g. https://pub-xxxx.r2.dev

function client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    },
  });
}

const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

export async function POST(req: Request) {
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) {
    return NextResponse.json(
      { error: "R2 not configured" },
      { status: 503 }
    );
  }

  const { dataUrl } = await req.json();
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return NextResponse.json({ error: "bad dataUrl" }, { status: 400 });
  }

  const m = dataUrl.match(/^data:(image\/\w+);base64,([\s\S]+)$/);
  if (!m) return NextResponse.json({ error: "bad dataUrl" }, { status: 400 });
  const contentType = m[1];
  const ext = contentType.split("/")[1] === "png" ? "png" : "jpg";
  const body = Buffer.from(m[2], "base64");
  const key = `visits/${uid()}.${ext}`;

  try {
    await client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
    return NextResponse.json({ url: `${publicBase.replace(/\/$/, "")}/${key}` });
  } catch (e) {
    return NextResponse.json(
      { error: `upload failed: ${(e as Error).message}` },
      { status: 502 }
    );
  }
}
