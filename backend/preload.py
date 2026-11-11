"""Download and load every detection model once (used at Docker build time to warm the cache).

Run manually with:  python preload.py
"""
import detectors

for name in detectors.IMAGE_MODELS:
    detectors._load(name, "image")
    print("ready:", name, flush=True)
for name in detectors.TEXT_MODELS:
    detectors._load(name, "text")
    print("ready:", name, flush=True)
print("all models cached")
