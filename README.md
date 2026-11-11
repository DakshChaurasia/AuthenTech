# AuthenTech

**Real. Or rendered?** AuthenTech checks whether an **image, video or piece of text** is AI-generated or authentic,
using two open-source detection models per media type and fusing their scores into one verdict with a confidence value.

![License: MIT](https://img.shields.io/badge/license-MIT-76b900)
![Python 3.12](https://img.shields.io/badge/python-3.12-76b900)
![FastAPI](https://img.shields.io/badge/backend-FastAPI-76b900)
![Frontend: plain HTML/CSS/JS](https://img.shields.io/badge/frontend-HTML%20%2F%20CSS%20%2F%20JS-76b900)

**Repository:** <https://github.com/DakshChaurasia/AuthenTech>

> Results are probabilistic estimates, **not proof**. See [Limitations](#limitations-and-responsible-use).

## Features

- **Three scan modes** on one page: Image, Video (up to 1 minute) and Text.
- **Two models per mode, averaged.** Each verdict lists the individual model scores, which makes disagreement between the
  models visible.
- **Calibrated scores.** Image-model scores are rescaled so that 50% means "undecided".
- **A single clear answer:** *Authentic* or *AI Generated*, with a confidence percentage.
- **Private by design.** Uploads are analyzed and discarded. Nothing is stored or logged.
- **Interactive landing page** with a draggable authentic-vs-AI comparison slider, scroll-driven effects, a custom scrollbar
  and a live "scan" animation. Plain HTML, CSS and JavaScript: no framework, no build step.
- Runs on **CPU or an NVIDIA GPU** (auto-detected).

## How it works

```
Browser (static site)  ──upload──►  FastAPI backend  ──►  model A ┐
  frontend/                          backend/                      ├─ average ─► verdict + confidence
                                                         model B ┘
```

| Mode | Model A | Model B | Licenses |
|---|---|---|---|
| Image | [`Ateeqq/ai-vs-human-image-detector`](https://huggingface.co/Ateeqq/ai-vs-human-image-detector) | [`buildborderless/CommunityForensics-DeepfakeDet-ViT`](https://huggingface.co/buildborderless/CommunityForensics-DeepfakeDet-ViT) | Apache-2.0 / MIT |
| Video | same two image models, run on sampled frames (about one per 2–3 s, at most 30) | | |
| Text | [`ShantanuT01/vanguard-ai-text-detector`](https://huggingface.co/ShantanuT01/vanguard-ai-text-detector) | [`fakespot-ai/roberta-base-ai-text-detection-v1`](https://huggingface.co/fakespot-ai/roberta-base-ai-text-detection-v1) | MIT / Apache-2.0 |

The models were selected by benchmarking 6 text detectors and 7 image detectors on labelled data (see [Accuracy](#accuracy)).

## Accuracy

Measured on public datasets. Samples are small, so the figures are rough guides.

| Test | Result |
|---|---|
| Text: 88 samples (human vs. Gemma/Mistral/Qwen/Llama/Yi/GPT-4o) | 99% correct |
| Text: 16 samples of modern LLM writing in varied styles | 100% caught |
| Images: easy set (modern AI art vs. photos) | 100% |
| Images: hard set (Stable Diffusion 1.4/2.1/XL, DeepFloyd, AI art vs. photos and real art) | 92% |
| Images: calibrated on one set, tested on the other | 96% |

Image calibration was fitted on the same ~100 images used for these figures, so accuracy is expected to be lower on
generators outside the test sets.

## Limitations and responsible use

- **Detectors are sometimes wrong**, and newer generators are harder to catch than the ones tested.
- Known weak spots: very small (≈256 px) AI images, real artwork, posters with text overlays, casual human writing
  (scores near 50%), short or heavily edited text, and non-native English writing.
- Video is analyzed by sampling frames with the image models; it has not been validated on real AI-generated video.
- **A single result is not grounds for accusing anyone** of cheating, fraud or deception. It is one signal among several.

## Run locally

Requirements: Python 3.12 and about 3 GB of free disk space (the models download on first use). An NVIDIA GPU is optional.

```bash
git clone https://github.com/DakshChaurasia/AuthenTech.git
cd AuthenTech

python -m venv .venv
# Windows:  .venv\Scripts\activate        macOS/Linux:  source .venv/bin/activate

# PyTorch: choose the build matching the machine at https://pytorch.org/get-started/locally/
pip install torch                          # CPU build; for NVIDIA GPUs use the CUDA index URL from that page
pip install -r backend/requirements.txt

# start the app (serves the API and the website together)
cd backend
python -m uvicorn main:app --port 8000
```

The app is then available at <http://localhost:8000>. The first scan downloads the models (about 2.5 GB in total) and is
slow; later scans are fast.

`run.bat` (Windows) and `./run.sh` (macOS/Linux) perform the last step. Setting `AUTHENTECH_PY` selects a specific Python
interpreter; otherwise `.venv` in the project folder is used.

> **Windows:** very long project paths can make installation fail with "No such file or directory" errors inside
> `site-packages`. Creating the virtual environment in a short folder such as `C:\venv` avoids this.

## API

```bash
curl -F file=@photo.jpg http://localhost:8000/api/image
curl -F file=@clip.mp4  http://localhost:8000/api/video
curl -F "text=At least thirty words of text go here ..." http://localhost:8000/api/text
```

The same paths apply on any deployed backend address.

Response:

```json
{
  "verdict": "AI Generated",
  "confidence": 93.7,
  "ai_probability": 93.7,
  "models": { "Ateeqq/ai-vs-human-image-detector": 87.5, "buildborderless/CommunityForensics-DeepfakeDet-ViT": 100.0 }
}
```

Video responses also include `frames_analyzed`; text responses include `words_analyzed`. Errors return
`{"detail": "..."}` with status 400 (bad input) or 413 (file too large). Interactive documentation is served at `/docs`.

| Limit | Value |
|---|---|
| Image | 50 MB |
| Video | 500 MB and 60 seconds |
| Text | at least 30 words, up to 50,000 characters |

## Deploy

The project deploys in two parts:

- **Frontend** (`frontend/`): a static site on **Vercel**.
- **Backend** (`backend/`): a computer or server that can hold the models (roughly 4 GB of RAM) and is reachable over
  HTTPS. The default setup runs the backend on a local machine and publishes it through a **Cloudflare Tunnel**.
  `backend/Dockerfile` supports container hosts.

Vercel's serverless functions cannot run the backend: the models exceed their size cap (about 250 MB), there is no GPU, and
time limits are short.

Trade-offs of the tunnel setup: scans work only while the host machine, the backend and the tunnel are running, and the
address of a free quick tunnel changes on every restart.

Step-by-step instructions: **[docs/DEPLOY.md](docs/DEPLOY.md)**.

## Configuration

| Setting | Where | Purpose |
|---|---|---|
| `window.AUTHENTECH_API` | `frontend/config.js` | URL of the backend. `""` means same origin (local use). |
| `ALLOWED_ORIGINS` | backend environment | Comma-separated sites allowed to call the API from a browser (default `*`). |
| `AUTHENTECH_PY` | environment, for `run.bat` / `run.sh` | Python interpreter to use. |

## Project structure

```
AuthenTech/
├── frontend/            static website (deployed to Vercel)
│   ├── index.html  style.css  app.js
│   ├── config.js        backend URL
│   ├── vercel.json      headers / caching
│   └── assets/          demo images for the landing page
├── backend/             detection API (runs on a local machine, or in Docker on any server)
│   ├── main.py          FastAPI routes, limits, CORS
│   ├── detectors.py     models, calibration, video sampling, text chunking
│   ├── preload.py       downloads models (used at Docker build time)
│   └── Dockerfile  requirements.txt  README.md
├── docs/DEPLOY.md       deployment guide
├── run.bat  run.sh      local launchers
├── tunnel.bat           starts a Cloudflare quick tunnel and updates frontend/config.js (Windows)
├── scripts/tunnel.ps1   implementation of tunnel.bat
└── LICENSE
```

## Privacy

Uploaded files are processed by the backend and deleted immediately. Videos are written to a temporary file for decoding
and removed afterwards. The backend keeps no database and writes no upload logs. The website loads fonts from Google Fonts.
When the backend runs on a local machine behind a Cloudflare Tunnel, uploads pass through Cloudflare's network to that
machine. For self-hosted copies, the hosting provider's logging policy applies.

## Roadmap

- Rebuild the interface in React (web) and Flutter or React Native (mobile) against the same API.
- Validate video detection on real AI-generated clips; add temporal and audio checks.
- Rate limiting and optional API keys for public deployments.
- An always-on backend: a paid host, or a named tunnel with a fixed address.
- Larger benchmark, including recent generators (Flux, Midjourney v7, Sora-style video).

## Contributing

Issues and pull requests are welcome. Changes that add or swap a model should include benchmark numbers on a labelled set,
together with the data source, so that results can be compared with the [Accuracy](#accuracy) table.

## Demo images

The landing page compares an authentic photograph with an AI-generated version of it. The two files in `frontend/assets/`
must be images the project has the right to publish. Credits and licenses:

- `authentic.webp`: photo credit and license to be added.
- `ai.webp`: generator and license to be added.

## Acknowledgements

Detection models: Ateeqq, the Community Forensics authors (University of Michigan), ShantanuT01 (Vanguard) and Fakespot.
Evaluation data: the public Hugging Face datasets `gsingh1-py/train`, `dmitva/human_ai_generated_text`,
`Parveshiiii/AI-vs-Real`, `elsaEU/ELSA_D3` and `Hemg/AI-Generated-vs-Real-Images-Datasets`, and photos from picsum.photos.
Built with FastAPI, PyTorch and 🤗 Transformers.

## License

Code: [MIT](LICENSE). The models are separate works under their own licenses (MIT or Apache-2.0, linked above).
