# QR codes

Drop the generated QR images for the About section in this folder. The file
name has to match the `qr` field of the matching entry in
`src/content/connect.json`:

| File             | Entry in `connect.json` |
| ---------------- | ----------------------- |
| `instagram.png`  | `instagram`             |
| `whatsapp.png`   | `whatsapp`              |
| `github.png`     | `github`                |

Until a file exists the tile renders an "awaiting upload" frame, so entries can
be added before their code is generated. `.png`, `.jpg`, `.jpeg`, `.webp` and
`.svg` are all picked up.

Guidelines:

- Square, at least 512x512 (Astro serves a 320px-wide optimised copy).
- Solid light background with a dark pattern. The tiles sit on a dark card, so
  a transparent background makes the code unscannable.
- Keep the quiet zone (the blank margin) the generator produces — cropping it
  breaks scanning on some phones.
