# The analysis service, for Railway (model/railway.json points here; build context is the repo root).
# CPU only: Railway has no GPU. The weights aren't in the image; scripts/railway_start.sh
# downloads them on first start (into a volume, if one is attached).
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libgl1 libglib2.0-0 git \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /srv/model
COPY model/requirements-serve.txt .
RUN pip install --no-cache-dir torch==2.14.1 torchvision==0.29.1 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements-serve.txt
COPY model/ ./
ENV PYTHONUNBUFFERED=1
CMD ["bash", "scripts/railway_start.sh"]
