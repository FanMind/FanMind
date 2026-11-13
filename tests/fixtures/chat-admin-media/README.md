# Neutral #1425 Staging acceptance fixtures

Only generated solid blue pixels and a generated 440 Hz sine, no people or user
content. `neutral.png` is160×120 PNG; `neutral.mp4` is one second160×120 H.264/AAC.
Generated with Pillow Image.new RGB blue and ffmpeg lavfi color/sine, libx264/aac,
one thread. Rights belong to the synthetic test creator; no provider analysis.

`invalid.png` is fixed plain test text; `oversized.png` is exactly6291456 zero
bytes (6MiB), deliberately over the5MiB image input limit. It is invalid input
that must be rejected by size before processing. The private storage bucket limit
of25MiB is separate from the image input limit. No fixture contains private data.

Use the reviewed commit's HTTPS GitHub file downloads for browser file selection.
Remove only acceptance-owned Staging records/objects after testing, prove absence
and temporary cleanup. These source fixtures are reproducible test inputs.
