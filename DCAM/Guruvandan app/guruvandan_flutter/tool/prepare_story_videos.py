import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "build/video-tools"))
import imageio_ffmpeg

source = Path(sys.argv[1] if len(sys.argv) > 1 else r"D:\Guruvandan_Videos")
output = ROOT / "web/cinema/media/v1"
output.mkdir(parents=True, exist_ok=True)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
edit = json.loads((ROOT / "web/cinema/edit.json").read_text(encoding="utf-8"))
manifest = []
for shot in edit:
    duration = round((shot["end"] - shot["start"]) * 24) / 24
    record = {**shot, "duration": duration, "fps": 24}
    for suffix, width, quality in [("", 1280, 23), ("-small", 768, 24)]:
        target = output / f"{shot['id']}{suffix}.mp4"
        if not target.exists():
            subprocess.run([ffmpeg, "-v", "error", "-nostdin", "-n", "-ss", str(shot["start"]), "-i", str(source / shot["source"]), "-t", str(duration), "-an", "-vf", f"fps=24,scale={width}:-2", "-c:v", "libx264", "-preset", "fast", "-crf", str(quality), "-g", "6", "-keyint_min", "6", "-sc_threshold", "0", "-bf", "0", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-threads", "2", str(target)], check=True)
        record["small" if suffix else "src"] = f"/cinema/media/v1/{target.name}"
        record["smallBytes" if suffix else "bytes"] = target.stat().st_size
    poster = output / f"{shot['id']}.jpg"
    if not poster.exists():
        subprocess.run([ffmpeg, "-v", "error", "-nostdin", "-n", "-ss", "0", "-i", str(output / f"{shot['id']}.mp4"), "-frames:v", "1", "-q:v", "3", str(poster)], check=True)
    record["poster"] = f"/cinema/media/v1/{poster.name}"
    manifest.append(record)
    print(f"{shot['id']}: {duration:.2f}s / {record['bytes'] // 1024} KB / small {record['smallBytes'] // 1024} KB", flush=True)
(output / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
