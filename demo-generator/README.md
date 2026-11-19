# RigDesk judge demo generator

Records the **actual website** through Playwright at 1920×1080, synthesizes five narration chapters with `en-IN-PrabhatNeural`, and assembles a 90-second H.264/AAC MP4 with captions, visible cursor movements and chapter labels. Customer/owner profiles are fictional, isolated browser demos; no real account, production seed, payment or message is submitted.

## Setup and run

From the repository root, with Python 3.11+ and Node/npm already installed:

```powershell
python -m venv demo-generator/.venv
demo-generator/.venv/Scripts/python.exe -m pip install -r demo-generator/requirements.txt
# Existing Windows Chrome is used if installed. Only the recording helper is needed:
demo-generator/.venv/Scripts/python.exe -m playwright install ffmpeg
demo-generator/.venv/Scripts/python.exe demo-generator/generate.py --self-check
demo-generator/.venv/Scripts/python.exe demo-generator/generate.py --inspect
demo-generator/.venv/Scripts/python.exe demo-generator/generate.py
```

If Chrome is absent, also run `python -m playwright install chromium` using the same environment. Allow enough disk space for the browser and raw videos. Dependencies are pinned to the versions used for this generator, separately from the application's package manifest.

By default the script reuses `http://127.0.0.1:5180` or automatically starts `npm run dev` there. It shuts down only a server it started. Standard output identifies the exact final path, duration and media checks. The default final file is **`demo-generator/rigdesk-judge-demo.mp4`**.

To use production instead:

```powershell
demo-generator/.venv/Scripts/python.exe demo-generator/generate.py --base-url https://rigdesk-marketplace-rig-logi-x.vercel.app/
```

Optional flags:

- `--headed`: show the isolated browser while recording.
- `--voice en-US-AndrewNeural`: alternative neural voice.
- `--work-dir D:/RigDesk-demo/artifacts`: put raw media, temporary browser data and evidence on another drive.
- `--output D:/RigDesk-demo/rigdesk-judge-demo.mp4`: choose the final output path.
- `--audio-only`: synthesize/fit chapters without recording.
- `--resume`: reuse existing completed clips from **the same inspected build**. Omit after UI or scene changes.
- `--inspect`: inspect public/customer/owner routes and rehearse scene actions, saving browser screenshots. No video or speech generation.

Set `PLAYWRIGHT_BROWSERS_PATH` consistently during helper installation and execution if using a different drive for Playwright's binaries. Online speech requires network access. The secondary online voice and then Windows `System.Speech` are fallbacks; the manifest reports the actual engine. Offline system speech has lower naturalness than a neural voice.

## Timing and claims

| Time | Actual screens | Narration boundary |
| --- | --- | --- |
| 0–15 seconds | Landing and customer dashboard | The 80% observation is attributed to the founder, not a national statistic. |
| 15–35 seconds | Equipment photos, quotes/owner quantities, bid review and quality sorting | Comparisons use explicit rules; predictive AI pricing is planned. The Gemini endpoint is prepared, not demonstrated as an active prediction engine. |
| 35–55 seconds | Booking estimate, recorded bond, presentation bond example | Reserve examples are simulated. Real funded escrow needs onboarding. No claim of guaranteed cancellation prevention, legal enforceability or instant payouts. |
| 55–75 seconds | Fuel map/vouchers and workforce directory/hiring/negotiation | Pump agreements and actual employers/workers are still needed; samples are labelled. |
| 75–90 seconds | Owner operations and an explicitly labelled presentation closing card | 2.5% owner-side fee is a **proposal**. Existing prototype customer quote fees are not changed. ₹2,500 on ₹1 lakh is gross revenue before costs. |

The exact spoken text is in [narration.json](narration.json). A 90-second film summarizes the main workflows; it cannot demonstrate every individual control or establish field validation. [Feature coverage](feature-coverage.md) records the broader inspection and omitted operational dependencies.

## Verification artifacts

The work directory contains:

- `route-inventory.json`: active TSX file inventory, literal routes and source commit.
- `browser-route-checks.json`: real browser page checks, headings and uncaught errors.
- `route-*.png` / `probe-*.png`: route and scene rehearsal evidence.
- `speech-*.mp3`, `voiceover.mp3`: actual synthesized narration and fitted 90-second track.
- `raw/*.webm` / `clip-*.mp4`: Playwright recordings and timed clips.
- `captions.ass`: sentence-level captions, apportioned by spoken word count within each fitted chapter.
- `recording-events.json`, `manifest.json`: recording details, final metadata and decode status.
- `filmstrip.jpg`: a contact sheet of the exported video for visual review.

The final verifier checks duration, 1080p resolution and AAC audio, then **decodes the complete MP4** with FFmpeg. Browser errors or missing required scene controls fail the run; the pipeline does not substitute fabricated application screens. The last nine seconds are clearly marked as a presentation card.

Technical references: [Playwright video recording](https://playwright.dev/python/docs/videos), [edge-tts](https://github.com/rany2/edge-tts), [FFmpeg](https://ffmpeg.org/).
