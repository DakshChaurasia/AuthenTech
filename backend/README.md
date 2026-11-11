# AuthenTech API

FastAPI backend for [AuthenTech](https://github.com/DakshChaurasia/AuthenTech), a detector for AI-generated
images, videos and text. Each media type is scored by two open-source models whose scores are averaged.

| Endpoint | Method | Body | Purpose |
|---|---|---|---|
| `/api/health` | GET | – | status and compute device |
| `/api/image` | POST | `file` (multipart, ≤ 50 MB) | image verdict |
| `/api/video` | POST | `file` (multipart, ≤ 500 MB, ≤ 60 s) | video verdict (sampled frames) |
| `/api/text` | POST | `text` (form field, ≥ 30 words) | text verdict |
| `/docs` | GET | – | interactive API docs |

Run it with `python -m uvicorn main:app --port 8000` from this folder (see the main README for setup), or build the
included `Dockerfile` to run it in a container.

| Environment variable | Purpose |
|---|---|
| `ALLOWED_ORIGINS` | Comma-separated websites allowed to call the API from a browser. Default `*` (any). |

Uploads are analyzed in memory or in a temporary file that is deleted immediately. Nothing is stored.

Results are probabilistic estimates, not proof.
