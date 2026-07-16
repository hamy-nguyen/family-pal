"""Local OCR endpoint for Family Pal — Apple Vision via ocrmac.

POST /ocr  { "image": "<data URL or base64>" }  ->  { "text": "<raw text>" }

WHY Apple Vision: it's built into macOS (no model weights), GPU-accelerated on
M1, and strong on printed text — ideal for a self-hosted POC endpoint. The app's
/api/ocr route forwards here; structuring into fields happens later in the app.
"""

import base64
import io

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from PIL import Image
from ocrmac import ocrmac

app = FastAPI(title="Family Pal OCR")


class OcrRequest(BaseModel):
    image: str  # data URL ("data:image/...;base64,XXXX") or bare base64


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/ocr")
def ocr(req: OcrRequest):
    raw = req.image.strip()
    if raw.startswith("data:") and "," in raw:
        raw = raw.split(",", 1)[1]  # drop the data-URL prefix
    try:
        img_bytes = base64.b64decode(raw)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"bad image: {e}")

    # annotations: list of (text, confidence, bbox). bbox is normalized with a
    # bottom-left origin, so higher y = higher on the page. Sort top-to-bottom
    # then left-to-right to reconstruct reading order. WHY round y: groups words
    # that sit on the same visual line despite tiny y differences.
    # Vietnamese first, English fallback (drug names are Latin: Cefixime, etc.).
    # NB: macOS Vision's Vietnamese code is "vi-VT", not "vi-VN".
    annotations = ocrmac.OCR(
        img, language_preference=["vi-VT", "en-US"]
    ).recognize()
    annotations.sort(key=lambda a: (-round(a[2][1], 2), a[2][0]))
    text = "\n".join(a[0] for a in annotations)

    return {"text": text}
