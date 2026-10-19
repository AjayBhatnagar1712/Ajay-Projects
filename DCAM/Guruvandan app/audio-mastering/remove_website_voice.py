from pathlib import Path
import hashlib
import json
import os
import subprocess

import numpy as np
import soundfile as sf
import torch
from demucs.apply import apply_model
from demucs.pretrained import get_model

root = Path(__file__).resolve().parent.parent
source = root / "guruvandan_flutter/web/audio/santmat-pravachan-2026-09-30.mp3"
output_dir = root / "audio-mastering/voice-free"
output_dir.mkdir(exist_ok=True)
original_hash = hashlib.sha256(source.read_bytes()).hexdigest()
torch.set_num_threads(min(4, os.cpu_count() or 1))
model = get_model("htdemucs")
model.eval()
sample_rate = model.samplerate
decoded = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", str(source), "-ar", str(sample_rate),
     "-ac", "2", "-f", "f32le", "-"],
    check=True, stdout=subprocess.PIPE,
)
wave = torch.from_numpy(np.frombuffer(decoded.stdout, dtype=np.float32).copy().reshape(-1, 2).T)
reference = wave.mean(0)
mean, std = reference.mean(), reference.std()
with torch.no_grad():
    sources = apply_model(model, ((wave - mean) / std)[None], device="cpu", shifts=1,
                          split=True, overlap=0.25, progress=True)[0]
sources = sources * std + mean
instrumental = sum(sources[i] for i, name in enumerate(model.sources) if name != "vocals")
wav_path = output_dir / "Santmat Background - Without Voice.wav"
sf.write(wav_path, instrumental.T.numpy(), sample_rate, subtype="PCM_24")
mp3_path = output_dir / "Santmat Background - Without Voice.mp3"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav_path),
                "-c:a", "libmp3lame", "-b:a", "320k", str(mp3_path)], check=True)
assert hashlib.sha256(source.read_bytes()).hexdigest() == original_hash
print(json.dumps({"output": str(mp3_path), "duration_seconds": wave.shape[1] / sample_rate,
                  "source_unchanged": True}), flush=True)
