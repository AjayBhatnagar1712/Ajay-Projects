import json
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "build/video-tools"))
import imageio_ffmpeg

SOURCE = Path(sys.argv[1] if len(sys.argv) > 1 else r"D:\Guruvandan_Videos")
OUTPUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "build/video-review"
OUTPUT.mkdir(parents=True, exist_ok=True)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
files = sorted(SOURCE.glob("*.mp4"), key=lambda item: (int(re.search(r"\d+", item.name)[0]) if re.search(r"\d+", item.name) else 99, item.name))
records = []
for video in files:
    metadata = subprocess.run([ffmpeg, "-hide_banner", "-i", str(video)], capture_output=True, text=True).stderr
    match = re.search(r"Duration: (\d+):(\d+):([\d.]+)", metadata)
    duration = int(match[1]) * 3600 + int(match[2]) * 60 + float(match[3])
    stream = next(line.strip() for line in metadata.splitlines() if "Video:" in line)
    sheet = Image.new("RGB", (1280, 280), "#101819")
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 8), f"{video.name} | {duration:.2f}s | {stream}", fill="white")
    for index, fraction in enumerate([0.04, 0.33, 0.66, 0.94]):
        frame = OUTPUT / f"{video.stem}-{index}.jpg"
        subprocess.run([ffmpeg, "-v", "error", "-y", "-ss", str(duration * fraction), "-i", str(video), "-frames:v", "1", "-vf", "scale=320:-2", str(frame)], check=True)
        with Image.open(frame) as image:
            sheet.paste(image, (index * 320, 48))
        draw.text((index * 320 + 8, 245), f"{duration * fraction:.2f}s", fill="#d4b779")
    sheet.save(OUTPUT / f"{video.stem}-sheet.jpg")
    records.append({"file": video.name, "duration": duration, "stream": stream, "bytes": video.stat().st_size})
    print(json.dumps(records[-1]), flush=True)
(OUTPUT / "inventory.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
for offset in range(0, len(files), 6):
    contact = Image.new("RGB", (1280, 280 * min(6, len(files) - offset)), "#101819")
    for row, video in enumerate(files[offset:offset + 6]):
        with Image.open(OUTPUT / f"{video.stem}-sheet.jpg") as sheet:
            contact.paste(sheet, (0, row * 280))
    contact.save(OUTPUT / f"contact-{offset // 6 + 1}.jpg")
