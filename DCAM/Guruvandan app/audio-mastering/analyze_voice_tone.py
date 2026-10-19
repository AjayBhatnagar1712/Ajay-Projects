import subprocess
import sys

import numpy as np


source = sys.argv[1]
ffmpeg = sys.argv[2]
process = subprocess.run(
    [ffmpeg, "-v", "error", "-i", source, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
    check=True,
    stdout=subprocess.PIPE,
)
audio = np.frombuffer(process.stdout, dtype=np.float32)
sample_rate = 16000
window = 2048
hop = 640
frequencies = []
for start in range(0, max(0, len(audio) - window), hop):
    frame = audio[start : start + window]
    if np.sqrt(np.mean(frame * frame)) < 0.01:
        continue
    frame = (frame - frame.mean()) * np.hanning(window)
    spectrum = np.fft.rfft(frame, n=4096)
    autocorrelation = np.fft.irfft(spectrum * np.conj(spectrum))[:window]
    minimum_lag = sample_rate // 350
    maximum_lag = sample_rate // 75
    segment = autocorrelation[minimum_lag:maximum_lag]
    lag = minimum_lag + int(np.argmax(segment))
    confidence = autocorrelation[lag] / max(autocorrelation[0], 1e-9)
    if confidence > 0.35:
        frequencies.append(sample_rate / lag)

if not frequencies:
    raise SystemExit("No stable vocal pitch detected")

values = np.array(frequencies)
print(f"median_hz={np.median(values):.1f}")
print(f"lower_quartile_hz={np.percentile(values, 25):.1f}")
print(f"upper_quartile_hz={np.percentile(values, 75):.1f}")
print(f"voiced_frames={len(values)}")
