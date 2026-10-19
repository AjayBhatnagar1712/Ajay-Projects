from pathlib import Path
import hashlib
import os
import subprocess
import torch
from audio_separator.separator import Separator

root = Path(__file__).resolve().parent.parent
source = root / "guruvandan_flutter/web/audio/santmat-pravachan-2026-09-30.mp3"
folder = root / "audio-mastering/voice-free/refined"
folder.mkdir(parents=True, exist_ok=True)
checksum = hashlib.sha256(source.read_bytes()).hexdigest()
decoded_source = folder / "source-for-separation.wav"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(source),
                "-c:a", "pcm_s24le", "-ar", "44100", str(decoded_source)], check=True)
torch.set_num_threads(4)
separator = Separator(
    output_dir=str(folder), output_format="WAV", use_soundfile=True,
    model_file_dir=str(root / "audio-mastering/.separation-models"),
    normalization_threshold=0.95, amplification_threshold=0.0,
    mdx_params={"hop_length": 1024, "segment_size": 256, "overlap": 0.25, "batch_size": 1, "enable_denoise": False},
    ensemble_algorithm="uvr_min_spec",
)
separator.load_model(model_filename=["Kim_Vocal_2.onnx", "UVR-MDX-NET-Inst_HQ_3.onnx"])
separator.separate(str(decoded_source), {"Instrumental": "Santmat Background - Refined", "Vocals": "removed-voice"})
wav = folder / "Santmat Background - Refined.wav"
mp3 = folder / "Santmat Background - Refined.mp3"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav),
                "-af", "alimiter=limit=0.95:level=false", "-c:a", "libmp3lame",
                "-b:a", "320k", str(mp3)], check=True)
assert hashlib.sha256(source.read_bytes()).hexdigest() == checksum
print(f"Exported: {mp3}; original website audio unchanged", flush=True)
