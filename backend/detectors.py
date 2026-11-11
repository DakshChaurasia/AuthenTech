"""AuthenTech detectors: two open-source models per modality, scores averaged.

Models were chosen by benchmarking (see README "How the models were chosen").
Image-model scores are calibrated with Platt scaling (sigmoid(a * logit(p) + b)) because the raw
scores of these models are not centred on 50%.
"""
import math
import threading
from dataclasses import dataclass

import cv2
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForImageClassification
from transformers import AutoTokenizer, AutoModelForSequenceClassification

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Labels (lowercase) that mean "AI generated" for models with named labels.
AI_LABELS = {"artificial", "ai", "fake", "chatgpt", "machine", "generated", "ai-generated", "aigenerated"}

IMAGE_MODELS = [
    "Ateeqq/ai-vs-human-image-detector",                  # labels: ai / hum
    "buildborderless/CommunityForensics-DeepfakeDet-ViT",  # single logit -> sigmoid = P(fake)
]
TEXT_MODELS = [
    "ShantanuT01/vanguard-ai-text-detector",               # ModernBERT-large, single logit -> sigmoid = P(AI)
    "fakespot-ai/roberta-base-ai-text-detection-v1",       # labels: Human / AI
]

# Platt calibration per image model: p_cal = sigmoid(a * logit(p_raw) + b), fit on 100 labelled images
# (two independent test sets). Text models are used as-is (already well centred at 0.5).
CALIBRATION = {
    "Ateeqq/ai-vs-human-image-detector": (0.2741, -0.5790),
    "buildborderless/CommunityForensics-DeepfakeDet-ViT": (1.1853, 7.4673),
}

# Load kwargs for models that need them (ModernBERT tries to torch.compile, which needs a C++ toolchain on Windows).
LOAD_KWARGS = {"ShantanuT01/vanguard-ai-text-detector": {"reference_compile": False}}

MAX_VIDEO_SECONDS = 60
MAX_VIDEO_FRAMES = 30
MIN_TEXT_WORDS = 30


@dataclass
class Loaded:
    name: str
    model: torch.nn.Module
    processor: object
    ai_idx: int | None  # None = single-logit model (sigmoid)


_cache: dict[str, Loaded] = {}
_lock = threading.Lock()


def _ai_index(model) -> int | None:
    if model.config.num_labels == 1:
        return None
    for idx, label in model.config.id2label.items():
        if str(label).strip().lower() in AI_LABELS:
            return int(idx)
    raise ValueError(f"Cannot find AI label in {model.config.id2label}")


def _load(name: str, kind: str) -> Loaded:
    with _lock:
        if name in _cache:
            return _cache[name]
        kw = LOAD_KWARGS.get(name, {})
        if kind == "image":
            proc = AutoImageProcessor.from_pretrained(name)
            model = AutoModelForImageClassification.from_pretrained(name, **kw)
        else:
            proc = AutoTokenizer.from_pretrained(name)
            model = AutoModelForSequenceClassification.from_pretrained(name, **kw)
        model.to(DEVICE).eval()
        _cache[name] = Loaded(name, model, proc, _ai_index(model))
        return _cache[name]


def _probs_from_logits(m: Loaded, logits: torch.Tensor) -> list[float]:
    if m.ai_idx is None:
        p = torch.sigmoid(logits[:, 0])
    else:
        p = torch.softmax(logits, dim=-1)[:, m.ai_idx]
    return [float(x) for x in p.float().cpu()]


def _calibrate(name: str, p: float) -> float:
    if name not in CALIBRATION:
        return p
    a, b = CALIBRATION[name]
    p = min(max(p, 1e-4), 1 - 1e-4)
    z = a * math.log(p / (1 - p)) + b
    return 1 / (1 + math.exp(-z))


@torch.inference_mode()
def _image_probs(m: Loaded, images: list[Image.Image]) -> list[float]:
    """Calibrated P(AI) for each image."""
    inputs = m.processor(images=images, return_tensors="pt").to(DEVICE)
    raw = _probs_from_logits(m, m.model(**inputs).logits)
    return [_calibrate(m.name, p) for p in raw]


@torch.inference_mode()
def _text_ai_prob(m: Loaded, chunks: list[str]) -> float:
    inputs = m.processor(chunks, return_tensors="pt", truncation=True, max_length=512, padding=True)
    inputs.pop("token_type_ids", None)
    inputs = inputs.to(DEVICE)
    ps = _probs_from_logits(m, m.model(**inputs).logits)
    return sum(ps) / len(ps)


def _result(scores: dict[str, float]) -> dict:
    avg = sum(scores.values()) / len(scores)
    ai = avg >= 0.5
    return {
        "verdict": "AI Generated" if ai else "Authentic",
        "confidence": round(max(avg, 1 - avg) * 100, 1),
        "ai_probability": round(avg * 100, 1),
        "models": {k: round(v * 100, 1) for k, v in scores.items()},
    }


def detect_image(img: Image.Image) -> dict:
    img = img.convert("RGB")
    scores = {n: _image_probs(_load(n, "image"), [img])[0] for n in IMAGE_MODELS}
    return _result(scores)


def sample_frames(path: str) -> list[Image.Image]:
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise ValueError("Could not read this video file.")
    fps = cap.get(cv2.CAP_PROP_FPS) or 0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    if fps <= 0 or total <= 0:
        raise ValueError("Could not read this video file.")
    duration = total / fps
    if duration > MAX_VIDEO_SECONDS + 0.5:
        raise ValueError(f"Video is {duration:.0f}s long. Maximum is {MAX_VIDEO_SECONDS} seconds.")
    n = max(1, min(MAX_VIDEO_FRAMES, int(duration)))  # about one frame per second
    frames = []
    for i in range(n):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int((i + 0.5) * total / n))
        ok, frame = cap.read()
        if ok:
            frames.append(Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)))
    cap.release()
    if not frames:
        raise ValueError("Could not read any frames from this video.")
    return frames


def detect_video(path: str) -> dict:
    frames = sample_frames(path)
    scores = {}
    for n in IMAGE_MODELS:
        m = _load(n, "image")
        per_frame = []
        for i in range(0, len(frames), 8):  # batches of 8 keep memory low on small GPUs
            per_frame += _image_probs(m, frames[i:i + 8])
        scores[n] = sum(per_frame) / len(per_frame)
    out = _result(scores)
    out["frames_analyzed"] = len(frames)
    return out


def detect_text(text: str) -> dict:
    words = text.split()
    if len(words) < MIN_TEXT_WORDS:
        raise ValueError(f"Please enter at least {MIN_TEXT_WORDS} words (you entered {len(words)}). Short text is unreliable.")
    chunks = [" ".join(words[i:i + 200]) for i in range(0, len(words), 200)][:8]
    if len(chunks) > 1 and len(chunks[-1].split()) < 30:
        chunks.pop()
    scores = {n: _text_ai_prob(_load(n, "text"), chunks) for n in TEXT_MODELS}
    out = _result(scores)
    out["words_analyzed"] = sum(len(c.split()) for c in chunks)
    return out
