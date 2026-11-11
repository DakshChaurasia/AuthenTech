# Deployment guide

AuthenTech consists of two independently hosted parts.

| Part | Folder | Hosting |
|---|---|---|
| Website | `frontend/` | **Vercel**, as a static site |
| Detection API (PyTorch models) | `backend/` | A **local machine or server**, published over HTTPS with a **Cloudflare Tunnel** |

Repository: <https://github.com/DakshChaurasia/AuthenTech>

## Architecture and constraints

- **The backend cannot run on Vercel.** The models total several GB. Vercel serverless functions are limited to roughly
  250 MB, have no GPU and enforce short execution times. Vercel is suitable for the static website only.
- **The backend needs a machine that can hold the models:** about 4 GB of RAM, plus about 3 GB of disk for the model cache.
  An NVIDIA GPU speeds up scans considerably but is optional.
- **A tunnel makes a local backend reachable.** A Cloudflare quick tunnel gives a local port a public HTTPS address without
  an account or router configuration.
- **The website finds the backend through `frontend/config.js`**, which holds the backend's base URL.

```
Visitor's browser ──► Vercel (static website) ──► https://<tunnel>.trycloudflare.com ──► local backend (port 8000)
```

## Prerequisites

- A GitHub account and an empty repository.
- A Vercel account (signing in with GitHub is the simplest option).
- The backend environment from the README section *Run locally* (virtual environment, PyTorch, `requirements.txt`).
- `cloudflared`, the Cloudflare Tunnel client (step 3).

## 1. Publish the repository

Create the repository on GitHub with **README, .gitignore and license all switched off**, because the project already
contains them. Then, from the project folder:

```bash
git init -b main
git add .
git commit -m "Initial commit: AuthenTech"
git remote add origin https://github.com/DakshChaurasia/AuthenTech.git
git push -u origin main
```

The images in `frontend/assets/` are published with the repository and must be images the project has the right to publish.

## 2. Start the backend

Start the backend with `run.bat` (Windows) or `./run.sh` (macOS/Linux). It listens on `http://localhost:8000`.

Check that `http://localhost:8000/api/health` returns `{"ok":true,...}` and that a test scan returns a verdict. The first scan
downloads the models (about 2.5 GB) and is slow; later scans are fast.

## 3. Publish the backend with a Cloudflare quick tunnel

1. Download `cloudflared` from the official releases page: <https://github.com/cloudflare/cloudflared/releases>
   (Windows: `cloudflared-windows-amd64.exe`, a single executable that needs no installer or account).
2. With the backend running, start the tunnel in a second terminal:

   ```bash
   cloudflared tunnel --url http://localhost:8000
   ```

3. After a few seconds an address of the form `https://random-words.trycloudflare.com` is printed. Opening
   `https://random-words.trycloudflare.com/api/health` should return `{"ok":true,...}`.

Both processes (backend and tunnel) must keep running for the website to work.

**Windows shortcut:** `tunnel.bat` (which runs `scripts/tunnel.ps1`) starts the tunnel and writes the new address into
`frontend/config.js` automatically. It looks for `cloudflared` at `tools/cloudflared/cloudflared.exe` (ignored by Git) and then
on the PATH. Pressing Ctrl+C in its window stops the tunnel.

## 4. Point the website at the backend

Set the tunnel address in `frontend/config.js` (no trailing slash):

```js
window.AUTHENTECH_API = "https://random-words.trycloudflare.com";
```

Commit and push the change:

```bash
git add frontend/config.js
git commit -m "Update backend address"
git push
```

## 5. Deploy the website on Vercel

1. Open <https://vercel.com>, choose **Add New → Project** and import the `AuthenTech` repository.
2. Configure the project:
   - **Framework Preset:** Other
   - **Root Directory:** `frontend`
   - **Build Command, Output Directory, Install Command:** empty
3. Select **Deploy**. Every push to `main` redeploys the site automatically.

## 6. Restrict which websites may call the backend

By default the backend accepts requests from any website. The `ALLOWED_ORIGINS` environment variable restricts this to a
comma-separated list of origins. It must be set before the backend starts, for example in a launcher script:

```bat
set "ALLOWED_ORIGINS=https://<project>.vercel.app"
call "%~dp0run.bat"
```

On macOS/Linux: `ALLOWED_ORIGINS=https://<project>.vercel.app ./run.sh`. Several origins (for example a custom domain) are
separated by commas. Origins include the scheme (`https://`) and have no trailing slash. The backend must be restarted for the
change to take effect.

## 7. Verify

1. Open the Vercel address; the landing page loads.
2. Open a scan option, upload a photo and run **Analyze**; a verdict appears.
3. If the page reports that the detection server is offline: confirm that the backend and the tunnel are both running, that the
   address in `config.js` matches the tunnel's current address exactly, and that Vercel has finished redeploying.
4. If scans still fail, the browser console (F12) shows the cause. A CORS error means `ALLOWED_ORIGINS` does not contain the
   exact Vercel origin.

## Routine after each restart

A quick tunnel receives a new address every time it starts.

1. Start the backend (`run.bat`).
2. Start the tunnel (`tunnel.bat`, or the manual command from step 3). `tunnel.bat` also writes the new address into
   `frontend/config.js`; with the manual command the address is copied into that file by hand.
3. Commit and push `frontend/config.js`, then wait for Vercel to redeploy.

## Limits of this setup

- **Availability** depends on the host machine: scans work only while it is powered on and both the backend and the tunnel
  are running. Otherwise the website still loads and reports that the detection server is offline.
- **Quick tunnels have no uptime guarantee.**
- **Upload size and time.** In testing, a 120 MB upload passed through a quick tunnel without being blocked (about 50 seconds
  on a home connection). Larger uploads were not tested. Upload time is bounded by the host's upload bandwidth, so large
  videos are slow, and a video of several hundred MB can take minutes to arrive.
- **No rate limiting.** Anyone who knows the tunnel address can use the host's resources. Stopping the tunnel when not in use
  and restricting `ALLOWED_ORIGINS` reduce exposure.
- **Privacy.** Uploads travel through Cloudflare's network to the host machine, where they are analyzed and deleted.

## Always-on alternatives

The backend can run on any always-on host with at least 4 GB of RAM. Availability and pricing differ between providers.

- **Container hosts** (a VPS, Google Cloud Run, Render, Railway, Fly.io, or Hugging Face Spaces on a plan that permits Docker
  Spaces): build `backend/Dockerfile`, expose port 7860 and set `ALLOWED_ORIGINS`.
- **A Cloudflare named tunnel** with a custom domain gives the host machine a permanent address, so `config.js` never changes.
- **GPU hosting** makes video scans much faster; the code uses a GPU automatically when one is available (requires a CUDA build
  of PyTorch).
