# AuthenTech API — optional container image for any Docker host (a VPS, Cloud Run, a paid Hugging Face Space, ...).
# Not needed for the default setup, which runs the backend directly on the host machine.
# CPU-only PyTorch keeps the image smaller; the code uses a GPU automatically if one is present.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/home/user/.cache/huggingface \
    TOKENIZERS_PARALLELISM=false

# Hugging Face Spaces runs containers as user id 1000.
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"
WORKDIR /home/user/app

COPY --chown=user requirements.txt .
RUN pip install --user torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install --user -r requirements.txt

COPY --chown=user . .

# Download the four detection models into the image so the first request is not slow.
RUN python preload.py

EXPOSE 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
