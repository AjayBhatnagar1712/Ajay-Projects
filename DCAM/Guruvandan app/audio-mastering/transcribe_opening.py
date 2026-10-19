from faster_whisper import WhisperModel


audio_path = r"C:\Users\ajayb\Downloads\WhatsApp Audio 2026-09-29 at 18.20.17.mpeg"
model = WhisperModel("small", device="cpu", compute_type="int8")
segments, info = model.transcribe(
    audio_path,
    language="hi",
    beam_size=5,
    vad_filter=True,
    condition_on_previous_text=True,
)
print(f"language={info.language} probability={info.language_probability:.3f}")
for segment in segments:
    print(f"[{segment.start:.2f}-{segment.end:.2f}] {segment.text.strip()}")
