# Audio assets

The simulator looks for **two background music tracks** in this folder:

| File                       | Track id     | Suggested mood       |
| -------------------------- | ------------ | -------------------- |
| `bgm-cyberpunk.ogg`        | `cyberpunk`  | Tense, electronic    |
| `bgm-ambient.ogg`          | `ambient`    | Calm, focus          |

If a file is missing, the audio player simply stays silent — no crash. Add or
replace files to extend the catalogue (also update `DEFAULT_TRACKS` in
`src/services/AudioService.ts`).

## Where to find royalty-free music

- [Pixabay Music](https://pixabay.com/music/) — CC0 / no attribution required.
- [FreePD](https://freepd.com/) — public domain.
- [Free Music Archive](https://freemusicarchive.org/) — filter by CC-BY / CC0.

## Recommended encoding

- Container: `.ogg` (Vorbis) for size, or `.mp3` for compatibility.
- Bitrate: 96–128 kbps mono is plenty for background looping music.
- **Loopable**: trim silence at start/end so the loop point is seamless.

## Licensing

Do **not** commit copyrighted tracks. Use only material under permissive
licenses (CC0, CC-BY with attribution noted in the credits screen, or your own
work).
