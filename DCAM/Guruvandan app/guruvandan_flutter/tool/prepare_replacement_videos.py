import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "build/video-tools"))
import imageio_ffmpeg

source = Path(sys.argv[1] if len(sys.argv) > 1 else r"D:\Guruvandan_Videos\replacements")
recipe_path = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "web/cinema/revisions/2026-09-28.json"
recipe = json.loads(recipe_path.read_text(encoding="utf-8"))
if not re.fullmatch(r"v[1-9][0-9]*", recipe["version"]):
    raise ValueError("Expected a new numbered media version")
output = ROOT / "web/cinema/media" / recipe["version"]
if output.exists():
    raise FileExistsError(f"Preserving existing media: {output}. Use a new version for another encode.")
manifest = json.loads((ROOT / recipe["baseManifest"]).read_text(encoding="utf-8"))
replacements = {shot["id"]: shot for shot in recipe["shots"]}
if len(replacements) != len(recipe["shots"]) or not replacements.keys() <= {shot["id"] for shot in manifest}:
    raise ValueError("Unknown or duplicate replacement scene")
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
source_info = {}
for shot in recipe["shots"]:
    filename = source / shot["source"]
    frame_count, seconds = imageio_ffmpeg.count_frames_and_secs(str(filename))
    probe = imageio_ffmpeg.read_frames(str(filename))
    metadata = next(probe)
    probe.close()
    if metadata["fps"] != 24 or metadata["size"] != (1280, 720):
        raise ValueError(f"Review new source format before encoding {filename}: {metadata}")
    if not 0 <= shot["start"] < shot["end"] <= frame_count / 24:
        raise ValueError(f"Trim exceeds video frames: {filename}")
    source_info[shot["id"]] = {
        "source": shot["source"], "sha256": hashlib.sha256(filename.read_bytes()).hexdigest(),
        "sourceFrames": frame_count, "sourceVideoDuration": seconds,
        "start": shot["start"], "end": shot["end"], "review": shot["review"],
    }

output.mkdir(parents=True)
for record in manifest:
    if record["id"] not in replacements:
        continue
    shot = replacements[record["id"]]
    frames = round((shot["end"] - shot["start"]) * 24)
    record.update({"source": f"replacements/{shot['source']}", "start": shot["start"], "end": shot["end"], "duration": frames / 24, "fps": 24, "focus": shot["focus"]})
    if "portraitFit" in shot:
        record["portraitFit"] = shot["portraitFit"]
    for suffix, width, quality in [("", 1280, 23), ("-small", 768, 24)]:
        target = output / f"{shot['id']}{suffix}.mp4"
        subprocess.run([
            ffmpeg, "-v", "error", "-nostdin", "-n", "-ss", str(shot["start"]),
            "-i", str(source / shot["source"]), "-frames:v", str(frames), "-an",
            "-vf", f"fps=24,scale={width}:-2", "-c:v", "libx264", "-preset", "fast",
            "-crf", str(quality), "-g", "6", "-keyint_min", "6", "-sc_threshold", "0",
            "-bf", "0", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-threads", "2", str(target),
        ], check=True)
        actual_frames, actual_seconds = imageio_ffmpeg.count_frames_and_secs(str(target))
        if actual_frames != frames or abs(actual_seconds - frames / 24) > 0.05:
            raise ValueError(f"Unexpected encoded duration: {target}")
        record["small" if suffix else "src"] = f"/cinema/media/{recipe['version']}/{target.name}"
        record["smallBytes" if suffix else "bytes"] = target.stat().st_size
    poster = output / f"{shot['id']}.jpg"
    subprocess.run([ffmpeg, "-v", "error", "-nostdin", "-n", "-i", str(output / f"{shot['id']}.mp4"), "-frames:v", "1", "-q:v", "3", str(poster)], check=True)
    record["poster"] = f"/cinema/media/{recipe['version']}/{poster.name}"
    print(f"{shot['id']}: {frames} frames / {frames / 24:.2f}s / desktop {record['bytes']} bytes / phone {record['smallBytes']} bytes", flush=True)

(output / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
report = {"version": recipe["version"], "baseManifest": recipe["baseManifest"], "sources": source_info}
(output / "source-review.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(f"Complete: {output}. Existing v1 media and source videos were not modified.")
