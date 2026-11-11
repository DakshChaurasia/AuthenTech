import io
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError

import detectors

MAX_IMAGE_BYTES = 50 * 1024 * 1024
MAX_VIDEO_BYTES = 500 * 1024 * 1024
MAX_TEXT_CHARS = 50_000

app = FastAPI(title="AuthenTech")

# Cross-origin access, so the frontend (e.g. on Vercel) can call this API when it is hosted elsewhere.
# Set ALLOWED_ORIGINS to a comma-separated list, e.g. "https://authentech.vercel.app". Default "*" = any site.
_origins = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=_origins, allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["*"], allow_credentials=False)


@app.middleware("http")
async def no_stale_frontend(request, call_next):
    # Make browsers re-check the page, CSS and JS every load so edits always show up (API is never cached either).
    resp = await call_next(request)
    resp.headers["Cache-Control"] = "no-store" if request.url.path.startswith("/api") else "no-cache"
    return resp


def _read_limited(upload: UploadFile, limit: int) -> bytes:
    data = upload.file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"File too large (max {limit // (1024 * 1024)} MB).")
    return data


@app.get("/api/health")
def health():
    return {"ok": True, "device": detectors.DEVICE}


@app.post("/api/image")
def analyze_image(file: UploadFile = File(...)):
    data = _read_limited(file, MAX_IMAGE_BYTES)
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, "That file is not a valid image.")
    return detectors.detect_image(img)


@app.post("/api/video")
def analyze_video(file: UploadFile = File(...)):
    # Stream to a temp file (OpenCV needs a path), enforce size cap, always delete.
    suffix = Path(file.filename or "").suffix or ".mp4"
    fd, path = tempfile.mkstemp(suffix=suffix)
    try:
        size = 0
        with os.fdopen(fd, "wb") as out:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_VIDEO_BYTES:
                    raise HTTPException(413, "Video too large (max 500 MB).")
                out.write(chunk)
        try:
            return detectors.detect_video(path)
        except ValueError as e:
            raise HTTPException(400, str(e))
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


@app.post("/api/text")
def analyze_text(text: str = Form(...)):
    if len(text) > MAX_TEXT_CHARS:
        raise HTTPException(413, "Text too long.")
    try:
        return detectors.detect_text(text)
    except ValueError as e:
        raise HTTPException(400, str(e))


# Frontend (served last so /api routes win). Only when running the whole repo locally;
# a backend-only deployment (the Docker image) has no frontend folder and just serves the API.
FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
else:
    @app.get("/")
    def root():
        return {"name": "AuthenTech API", "docs": "/docs", "health": "/api/health"}
