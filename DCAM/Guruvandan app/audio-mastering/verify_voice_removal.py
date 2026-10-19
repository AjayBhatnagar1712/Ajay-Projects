from pathlib import Path
from faster_whisper import WhisperModel
import json
import subprocess
import numpy as np
import sys

audio = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / "voice-free/Santmat Background - Without Voice.mp3"
model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4)
decoded = subprocess.run(["ffmpeg", "-v", "error", "-i", str(audio), "-ar", "16000",
                          "-ac", "1", "-f", "f32le", "-"], check=True, stdout=subprocess.PIPE)
samples = np.frombuffer(decoded.stdout, dtype=np.float32).copy()
segments, _ = model.transcribe(samples, language="hi", beam_size=5, vad_filter=True,
                              condition_on_previous_text=False)
detected = [{"start": segment.start, "end": segment.end, "text": segment.text,
             "no_speech_probability": segment.no_speech_prob} for segment in segments]
print(json.dumps({"recognized_segments": detected}, ensure_ascii=True), flush=True)
