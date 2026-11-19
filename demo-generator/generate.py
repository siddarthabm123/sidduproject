"""Record the real RigDesk demo UI and assemble a narrated, verified 1080p film.

No real credentials, funding, production seeds or business transactions are used.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import html
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ART = HERE / "artifacts"
SCRIPT = json.loads((HERE / "narration.json").read_text(encoding="utf-8"))
WIDTH, HEIGHT = 1920, 1080
LIVE = "https://rigdesk-marketplace-rig-logi-x.vercel.app/"

# Scene intervals add up to the five user-requested chapters, exactly 90 seconds.
SCENES = [
    ("landing", "/", None, 9, 0),
    ("customer", "/customer/dashboard", "customer", 6, 0),
    ("discovery", "/customer/machinery", "customer", 7, 1),
    ("allocations", "/customer/machinery", "customer", 5, 1),
    ("bidding", "/customer/auctions", "customer", 8, 1),
    ("quote", "/customer/machinery", "customer", 7, 2),
    ("booking-bond", "/customer/bookings", "customer", 7, 2),
    ("bond-preview", "/pitch-highlights#bond", None, 6, 2),
    ("fuel", "/dashboard/owner/fuel-hub", "owner", 6, 3),
    ("vouchers", "/dashboard/owner/fuel-hub", "owner", 4, 3),
    ("workforce", "/dashboard/customer/hire-workers", "customer", 6, 3),
    ("negotiation", "/dashboard/owner/workforce", "owner", 4, 3),
    ("operations", "/owner/operations", "owner", 6, 4),
    ("closing", "/pitch-highlights#problem", None, 9, 4),
]

def log(message):
    print(message, flush=True)

def run(command, **kwargs):
    try:
        return subprocess.run([str(x) for x in command], check=True, capture_output=True, text=True, **kwargs)
    except subprocess.CalledProcessError as error:
        raise RuntimeError(f"Command failed: {command[0]}\n{error.stderr[-2000:]}") from error

def ffmpeg():
    import imageio_ffmpeg
    return shutil.which("ffmpeg") or imageio_ffmpeg.get_ffmpeg_exe()

def duration(path):
    probe = subprocess.run([ffmpeg(), "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    match = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", probe.stderr)
    if not match:
        raise RuntimeError(f"Cannot read media duration: {path}")
    return int(match[1]) * 3600 + int(match[2]) * 60 + float(match[3])

def self_check():
    assert sum(s[3] for s in SCENES) == 90
    assert [s["start"] for s in SCRIPT] == [0, 15, 35, 55, 75]
    for index, chapter in enumerate(SCRIPT):
        assert sum(s[3] for s in SCENES if s[4] == index) == chapter["duration"]
        assert 20 <= len(chapter["text"].split()) <= 52
    assert "planned" in SCRIPT[1]["text"]
    assert "not guaranteed" in SCRIPT[2]["text"]
    assert "proposed" in SCRIPT[4]["text"]
    log("Timeline and claim checks passed: 14 scenes, five chapters, 90 seconds.")

def audit_sources():
    files = []
    for directory, children, names in os.walk(ROOT):
        children[:] = [name for name in children if not name.startswith('.') and name not in {"node_modules", "output", "RigLogix-source-code", "RigLogix-runnable", "dist", "artifacts"}]
        files.extend(Path(directory) / name for name in names if name.endswith('.tsx'))
    files.sort()
    routes = []
    for path in files:
        text = path.read_text(encoding="utf-8")
        routes.extend({"file": str(path.relative_to(ROOT)), "path": match} for match in re.findall(r'<Route\s+path=["\']([^"\']+)', text))
    report = {"source_commit": run(["git", "rev-parse", "HEAD"], cwd=ROOT).stdout.strip(), "tsx_files": [str(p.relative_to(ROOT)) for p in files], "literal_routes": routes, "note": "Also inspect workforce/routes.ts and fuel/routes.ts for role-specific route resolvers. Archived source copies are excluded."}
    (ART / "route-inventory.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    log(f"Source inventory: {len(files)} TSX files, {len(routes)} literal routes.")
    return report

def ensure_server(base):
    if base:
        return base.rstrip("/"), None, None
    local = "http://127.0.0.1:5180"
    try:
        with urllib.request.urlopen(local, timeout=3) as response:
            if response.status == 200:
                return local, None, None
    except OSError:
        pass
    log("Starting npm run dev on localhost:5180...")
    stream = (ART / "dev-server.log").open("w", encoding="utf-8")
    if os.name == "nt":
        command = ["cmd.exe", "/d", "/c", "npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5180"]
    else:
        command = ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5180"]
    process = subprocess.Popen(command, cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    for _ in range(180):
        if process.poll() is not None:
            raise RuntimeError("Development server exited; inspect artifacts/dev-server.log")
        try:
            with urllib.request.urlopen(local, timeout=2) as response:
                if response.status == 200:
                    return local, process, stream
        except OSError:
            time.sleep(1)
    raise RuntimeError("Development server did not become ready within three minutes.")

async def speech(voice):
    import edge_tts
    selected = []
    for index, chapter in enumerate(SCRIPT):
        target = ART / f"speech-{index}.mp3"
        fingerprint = hashlib.sha256((voice + chapter["text"]).encode()).hexdigest()
        stamp = ART / f"speech-{index}.sha256"
        if target.exists() and stamp.exists() and stamp.read_text() == fingerprint:
            selected.append("cached " + voice)
            continue
        error = None
        for name in dict.fromkeys([voice, "en-US-AndrewNeural"]):
            try:
                await asyncio.wait_for(edge_tts.Communicate(chapter["text"], name, rate="+0%").save(str(target)), timeout=45)
                if duration(target) < 1:
                    raise RuntimeError("Empty narration")
                selected.append(name)
                stamp.write_text(fingerprint)
                log(f"Voice chapter {index + 1}: {name}, {duration(target):.2f}s")
                break
            except Exception as exc:
                error = exc
                log(f"Voice {name} unavailable: {type(exc).__name__}: {str(exc)[:180]}")
        else:
            # Offline Windows fallback is explicitly reported in the manifest.
            if os.name != "nt":
                raise RuntimeError(f"Online voice synthesis failed: {error}")
            source = ART / f"speech-{index}.txt"
            source.write_text(chapter["text"], encoding="utf-8")
            wav = ART / f"speech-{index}.wav"
            command = "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate=0; $s.SetOutputToWaveFile($args[1]); $s.Speak([IO.File]::ReadAllText($args[0])); $s.Dispose()"
            fallback = ART / "system-voice.ps1"
            fallback.write_text(command, encoding="utf-8")
            run(["powershell.exe", "-NoProfile", "-File", fallback, source, wav], timeout=60)
            run([ffmpeg(), "-y", "-i", wav, "-codec:a", "libmp3lame", "-q:a", "2", target])
            selected.append("Windows System.Speech offline fallback")
            log(f"Voice chapter {index + 1}: system fallback")
        stamp.write_text(fingerprint)
    paths = []
    for index, chapter in enumerate(SCRIPT):
        source = ART / f"speech-{index}.mp3"
        seconds = duration(source)
        # Keep speech inside its chapter, leaving a natural quarter-second tail.
        speed = max(0.90, seconds / (chapter["duration"] - 0.30))
        if speed > 1.30:
            raise RuntimeError(f"Chapter {index + 1} would sound rushed ({speed:.2f}x). Shorten its narration.")
        target = ART / f"voice-{index}.wav"
        run([ffmpeg(), "-y", "-i", source, "-af", f"atempo={speed:.5f},loudnorm=I=-16:TP=-1.5:LRA=11,apad", "-t", chapter["duration"], "-ar", "48000", "-ac", "2", target])
        paths.append(target.name)
    (ART / "voices.txt").write_text("".join(f"file '{path}'\n" for path in paths))
    run([ffmpeg(), "-y", "-f", "concat", "-safe", "0", "-i", "voices.txt", "-codec:a", "libmp3lame", "-b:a", "192k", "voiceover.mp3"], cwd=ART)
    return selected

OVERLAY = """({title,boundary})=>{
 document.getElementById('demo-recorder-overlay')?.remove();
 const el=document.createElement('div');el.id='demo-recorder-overlay';
 el.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:2147483645;background:#142824;color:white;padding:15px 38px 17px;border-top:3px solid #D9531E;font:600 20px/1.45 Arial,sans-serif;pointer-events:none;box-shadow:0 -8px 40px #14282422';
 const small=document.createElement('div');small.style.cssText='font-size:13px;color:#b7d5c7;letter-spacing:.4px';small.textContent='RIGDESK  /  JUDGE WALKTHROUGH  /  PRODUCT PROTOTYPE';
 const main=document.createElement('div');main.textContent=title;
 const note=document.createElement('span');note.style.cssText='float:right;font-size:13px;color:#e5e0d8;max-width:880px;text-align:right;padding-top:6px';note.textContent=boundary;
 main.append(note);el.append(small,main);document.body.append(el);
 const cursor=document.createElement('div');cursor.id='demo-cursor';cursor.style.cssText='position:fixed;width:20px;height:20px;border:2px solid white;border-radius:50%;background:#D9531Ebb;box-shadow:0 0 0 6px #D9531E22;z-index:2147483646;pointer-events:none;left:95%;top:85%';document.body.append(cursor);
 document.addEventListener('mousemove',e=>{cursor.style.left=(e.clientX-10)+'px';cursor.style.top=(e.clientY-10)+'px'});
} """

async def focus(page, locator, click=False):
    await locator.wait_for(state="visible", timeout=12000)
    await locator.evaluate("el=>el.scrollIntoView({behavior:'smooth',block:'center'})")
    await page.wait_for_timeout(650)
    box = await locator.bounding_box()
    if box:
        await page.mouse.move(box["x"] + box["width"] * 0.55, box["y"] + min(box["height"] / 2, 50), steps=35)
        await locator.evaluate("el=>{el.animate([{outline:'3px solid #D9531E',outlineOffset:'5px'},{outline:'3px solid transparent',outlineOffset:'8px'}],{duration:1900})}")
    if click:
        await locator.click()

async def settled(page):
    await page.wait_for_selector("h1:visible,h2:visible", timeout=45000)
    await page.wait_for_function("!document.body.innerText.includes('Loading page…')", timeout=15000)
    await page.evaluate("()=>document.fonts.ready")
    await page.wait_for_timeout(1000)
    if await page.get_by_role("heading", name="Something went wrong", exact=True).count():
        raise RuntimeError("The website displayed its error boundary")

async def demo_state(browser, base, role):
    context = await browser.new_context(viewport={"width": WIDTH, "height": HEIGHT}, locale="en-IN")
    page = await context.new_page()
    await page.goto(base + "/demo", wait_until="domcontentloaded", timeout=60000)
    await page.get_by_test_id(f"button-open-{role}-demo").click(timeout=45000)
    await page.wait_for_url(f"**/{role}/dashboard", timeout=45000)
    await settled(page)
    state = await context.storage_state()
    await context.close()
    return state

async def prepare(page, name):
    if name in {"allocations", "quote"}:
        # UI selector discovered from the active marketplace; no fake booking data.
        button = page.get_by_test_id("button-book-m-101")
        await focus(page, button, click=True)
        await page.wait_for_timeout(800)
        if name == 'allocations':
            await page.get_by_test_id('input-equipment-units').fill('3')
            await focus(page, page.get_by_text('Allocate units by owner', exact=True))
        else:
            await focus(page, page.get_by_text('Price estimate', exact=True).last)
    elif name == "bidding":
        await focus(page, page.get_by_role("button", name="Review bids").first, click=True)
        await page.wait_for_timeout(500)
    elif name == "booking-bond":
        await focus(page, page.get_by_text("RigDesk locked booking bond", exact=False).first)
    elif name == "vouchers":
        await focus(page, page.get_by_role("heading", name=re.compile("Active fuel vouchers")).first)
    elif name == "workforce":
        await page.get_by_text("Browse worker directory", exact=True).click()
        await focus(page, page.locator(".worker-card").first)
    elif name == "negotiation":
        await focus(page, page.get_by_role("heading", name="Hiring agreements", exact=True))
    elif name == "closing":
        await page.set_content(closing_html(), wait_until="load")

async def animate(page, name):
    if name == "landing":
        await page.wait_for_timeout(1800)
        await page.evaluate("window.scrollTo({top:500,behavior:'smooth'})")
    elif name == "customer":
        await focus(page, page.get_by_role("heading").first)
        await page.mouse.move(1500, 550, steps=40)
    elif name == "discovery":
        await page.mouse.move(1000, 440, steps=40)
        await page.evaluate("window.scrollBy({top:360,behavior:'smooth'})")
    elif name == "bidding":
        await focus(page, page.get_by_role("button", name="Best quality", exact=True), click=True)
    elif name == 'allocations':
        choices = page.get_by_label(re.compile('Book units'))
        await focus(page, choices.nth(0))
        await choices.nth(0).select_option('2')
        await choices.nth(1).select_option('1')
    elif name == 'quote':
        # Scroll the real modal, not a rebuilt illustration.
        await page.mouse.move(1250, 640, steps=30)
        await page.mouse.wheel(0, 330)
    elif name == "booking-bond":
        await page.mouse.move(1300, 630, steps=40)
        await page.mouse.wheel(0, 220)
    elif name == "fuel":
        await page.mouse.move(1060, 510, steps=40)
        await page.mouse.wheel(0, 220)
    elif name == "vouchers":
        await page.mouse.move(1130, 600, steps=30)
        await page.wait_for_timeout(1000)
        await focus(page, page.get_by_role('heading', name='Fuel bills & savings examples', exact=True))
    elif name == "workforce":
        await focus(page, page.locator(".worker-card").filter(has=page.get_by_role("button", name="Assign / Hire Worker", disabled=False)).first.get_by_role("button", name="Assign / Hire Worker"), click=True)
    elif name == "negotiation":
        await page.mouse.move(1300, 650, steps=30)
        await page.mouse.wheel(0, 220)
    elif name == "operations":
        await focus(page, page.get_by_text("Monthly cost planner", exact=True), click=True)

def closing_html():
    return f'''<!doctype html><html><meta charset="utf-8"><style>
    *{{box-sizing:border-box}}body{{margin:0;background:#142824;color:#F4F2ED;font:24px Arial,sans-serif;padding:115px 140px}}.tag{{color:#aacbb9;font-size:17px;letter-spacing:4px}}h1{{font-size:84px;line-height:1.05;margin:35px 0 22px;max-width:1400px}}h1 span{{color:#e98053}}p{{max-width:1420px;line-height:1.5}}.row{{display:flex;gap:24px;margin:45px 0}}.box{{border:1px solid #49655c;background:#1c3630;border-radius:20px;padding:30px 42px;min-width:390px}}.number{{font:600 53px Consolas,monospace;color:#f3b36b;display:block;margin-bottom:12px}}.url{{font-size:23px;color:#cce3d6}}small{{font-size:16px;color:#b9c9c3}}</style>
    <body><div class="tag">RIGDESK / PROPOSED BUSINESS MODEL</div><h1>Customers save.<br>Equipment works.<br><span>Trust stays in the transaction.</span></h1><div class="row"><div class="box"><span class="number">₹1,00,000</span>Illustrative work value</div><div class="box"><span class="number">2.5%</span>Proposed owner-side fee</div><div class="box"><span class="number">₹2,500</span>Platform gross revenue, before costs</div></div><p class="url">{html.escape(LIVE)}</p><small>Presentation card, not a payment screen. Proposed fee; current prototype quote fees remain unchanged.<br>Next step: a supervised local pilot with equipment owners, contractors and workers.</small></body></html>'''

async def inspect_routes(browser, base, states):
    paths = {None: ["/", "/demo", "/sign-in", "/launch-guide", "/privacy", "/terms", "/pitch-highlights#problem", "/pitch-highlights#pillars", "/pitch-highlights#bond"], "customer": ["/customer/dashboard", "/customer/machinery", "/customer/auctions", "/customer/bookings", "/customer/radar", "/customer/suppliers", "/dashboard/customer/hire-workers", "/dashboard/worker/create-profile", "/account"], "owner": ["/owner/dashboard", "/owner/fleet", "/owner/jobs", "/owner/equipment-radar", "/owner/operations", "/owner/suppliers", "/dashboard/owner/workforce", "/dashboard/owner/fuel-hub", "/account"]}
    rows = []
    for role, routes in paths.items():
        context = await browser.new_context(viewport={"width": WIDTH, "height": HEIGHT}, storage_state=states.get(role), locale="en-IN")
        page = await context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        for index, path in enumerate(routes):
            errors.clear()
            response = await page.goto(base + path, wait_until="domcontentloaded", timeout=60000)
            await settled(page)
            headings = await page.locator("h1,h2").all_text_contents()
            await page.screenshot(path=str(ART / f"route-{role or 'public'}-{index:02}.png"))
            row = {"role": role, "path": path, "status": response.status if response else 200, "headings": headings[:10], "errors": list(errors)}
            rows.append(row)
            log(f"Route {role or 'public'} {path}: {row['status']}, {len(errors)} browser errors")
            if row['status'] != 200 or errors:
                raise RuntimeError(f"Route failed: {row}")
        await context.close()
    (ART / "browser-route-checks.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    return rows

async def record(base, headed=False, inspect_only=False, resume=False):
    from playwright.async_api import async_playwright
    clips, events = [], []
    async with async_playwright() as playwright:
        installed_chrome = Path('C:/Program Files/Google/Chrome/Application/chrome.exe')
        launch = {"headless": not headed}
        if installed_chrome.exists():
            launch["executable_path"] = str(installed_chrome)
        browser = await playwright.chromium.launch(**launch)
        states = {role: await demo_state(browser, base, role) for role in ["customer", "owner"]}
        if inspect_only:
            await inspect_routes(browser, base, states)
            for index, (name, path, role, seconds, chapter) in enumerate(SCENES):
                context = await browser.new_context(viewport={"width": WIDTH, "height": HEIGHT}, storage_state=states.get(role), locale="en-IN")
                page = await context.new_page()
                await page.goto(base + path, wait_until="domcontentloaded", timeout=60000)
                await settled(page)
                await prepare(page, name)
                await page.evaluate(OVERLAY, {"title": SCRIPT[chapter]["title"], "boundary": SCRIPT[chapter]["boundary"]})
                await animate(page, name)
                await page.wait_for_timeout(900)
                await page.screenshot(path=str(ART / f"probe-{index:02}-{name}.png"))
                log(f"Scene preparation passed: {name}")
                await context.close()
            await browser.close()
            return []
        for index, (name, path, role, seconds, chapter) in enumerate(SCENES):
            target = ART / f"clip-{index:02}.mp4"
            reusable = False
            if resume and target.exists():
                try:
                    reusable = abs(duration(target) - seconds) < 0.15
                except RuntimeError:
                    pass
            if reusable:
                clips.append(target.name)
                events.append({"name": name, "route": path, "duration": seconds, "reused": True})
                log(f"Reusing checked clip: {name}")
                continue
            log(f"Recording {index + 1}/{len(SCENES)}: {name} ({seconds}s)")
            context = await browser.new_context(viewport={"width": WIDTH, "height": HEIGHT}, record_video_dir=str(ART / "raw"), record_video_size={"width": WIDTH, "height": HEIGHT}, storage_state=states.get(role), locale="en-IN", device_scale_factor=1)
            await context.add_init_script("window.print=()=>{}")
            started = time.monotonic()
            page = await context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            try:
                await page.goto(base + path, wait_until="domcontentloaded", timeout=60000)
                await settled(page)
                await prepare(page, name)
                await page.evaluate(OVERLAY, {"title": SCRIPT[chapter]["title"], "boundary": SCRIPT[chapter]["boundary"]})
                await page.screenshot(path=str(ART / f"scene-{index:02}-{name}.png"))
                lead = time.monotonic() - started
                scene_start = time.monotonic()
                await animate(page, name)
                await asyncio.sleep(max(0, seconds - (time.monotonic() - scene_start)))
                if errors:
                    raise RuntimeError("Browser error while recording: " + "; ".join(errors))
                raw = await page.video.path()
            except Exception:
                await page.screenshot(path=str(ART / "failure.png"))
                (ART / "failure.txt").write_text((await page.locator("body").inner_text())[:25000], encoding="utf-8")
                raise
            finally:
                await context.close()  # Required to finalize Playwright's WebM.
            target = ART / f"clip-{index:02}.mp4"
            run([ffmpeg(), "-y", "-filter_threads", "1", "-ss", f"{lead:.4f}", "-i", raw, "-an", "-vf", f"fps=30,scale={WIDTH}:{HEIGHT},setsar=1,tpad=stop_mode=clone:stop_duration={seconds}", "-t", seconds, "-c:v", "libx264", "-threads", "2", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", target])
            clips.append(target.name)
            events.append({"name": name, "route": path, "role": role, "duration": seconds, "trim_start": lead, "raw_video": str(raw), "errors": errors})
            (ART / "recording-events.json").write_text(json.dumps(events, indent=2))
        await browser.close()
    return clips

def captions():
    # Sentence-level captions, proportional to spoken word count per chapter.
    def stamp(value):
        centiseconds = round(value * 100)
        return f"{centiseconds // 360000}:{centiseconds // 6000 % 60:02}:{centiseconds // 100 % 60:02}.{centiseconds % 100:02}"
    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,30,&H00FFFFFF,&H000000FF,&H00142824,&HA0142824,0,0,0,0,100,100,0,0,3,1,0,2,220,220,112,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for chapter in SCRIPT:
        sentences = re.split(r"(?<=[.!?])\s+", chapter["text"])
        total = sum(len(s.split()) for s in sentences)
        at = chapter["start"]
        for sentence in sentences:
            end = at + chapter["duration"] * len(sentence.split()) / total
            events.append(f"Dialogue: 0,{stamp(at)},{stamp(end)},Default,,0,0,0,,{sentence}\n")
            at = end
    (ART / "captions.ass").write_text(header + "".join(events), encoding="utf-8")

def assemble(clips, output, voices, base, source):
    (ART / "clips.txt").write_text("".join(f"file '{path}'\n" for path in clips))
    captions()
    run([ffmpeg(), "-y", "-filter_threads", "1", "-f", "concat", "-safe", "0", "-i", "clips.txt", "-i", "voiceover.mp3", "-map", "0:v:0", "-map", "1:a:0", "-vf", "tpad=stop_mode=clone:stop_duration=1,ass=captions.ass", "-af", "apad", "-c:v", "libx264", "-threads", "2", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "192k", "-t", "90", "-movflags", "+faststart", output], cwd=ART)
    seconds = duration(output)
    assert abs(seconds - 90) < 0.2, f"Unexpected duration {seconds}"
    probe = subprocess.run([ffmpeg(), "-hide_banner", "-i", str(output)], capture_output=True, text=True)
    assert "1920x1080" in probe.stderr and "Audio: aac" in probe.stderr
    # Full decode detects truncated/corrupted streams, not just a valid header.
    run([ffmpeg(), "-v", "error", "-i", output, "-f", "null", "-"], timeout=180)
    level_check = run([ffmpeg(), '-hide_banner', '-i', output, '-af', 'volumedetect', '-vn', '-f', 'null', '-'])
    level = re.search(r'mean_volume: (-?[\d.]+) dB', level_check.stderr)
    assert level and float(level[1]) > -40, 'Narration is missing or too quiet'
    run([ffmpeg(), "-y", "-i", output, "-vf", "fps=1/7.5,scale=480:270,tile=4x3", "-frames:v", "1", "filmstrip.jpg"], cwd=ART)
    manifest = {"output": str(output), "duration_seconds": seconds, "resolution": "1920x1080", "fps": 30, "video": "H.264", "audio": "AAC", "mean_audio_db": float(level[1]), "bytes": output.stat().st_size, "base_url": base, "source_commit": source["source_commit"], "voices": voices, "scenes": len(clips), "verification": "Full audio/video decode and non-silent narration checks passed", "data": "Isolated fictional demo profiles; no real account or payment", "captions": "Sentence timings proportional to narration words; five chapter audio tracks individually fitted to exact intervals."}
    (ART / "manifest.json").write_text(json.dumps(manifest, indent=2))
    log(json.dumps(manifest, indent=2))

async def main():
    global ART
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", help="Default: reuse/start localhost:5180. May also use the live site.")
    parser.add_argument("--voice", default="en-IN-PrabhatNeural")
    parser.add_argument("--headed", action="store_true")
    parser.add_argument("--inspect", action="store_true", help="Browser route checks/screenshots only; no recording or voice synthesis")
    parser.add_argument("--self-check", action="store_true")
    parser.add_argument("--output", type=Path, default=HERE / "rigdesk-judge-demo.mp4")
    parser.add_argument("--audio-only", action="store_true")
    parser.add_argument("--resume", action="store_true", help="Reuse completed clips from the same inspected build; omit after source changes")
    parser.add_argument("--work-dir", type=Path, help="Artifact/temp directory on a drive with free space")
    args = parser.parse_args()
    if args.work_dir:
        ART = args.work_dir.resolve()
    ART.mkdir(parents=True, exist_ok=True)
    scratch = ART / 'tmp'
    scratch.mkdir(exist_ok=True)
    os.environ['TEMP'] = os.environ['TMP'] = str(scratch)
    self_check()
    if args.self_check:
        return
    source = audit_sources()
    if args.audio_only:
        await speech(args.voice)
        return
    voices = [] if args.inspect else await speech(args.voice)
    base, server, stream = ensure_server(args.base_url)
    try:
        clips = await record(base, args.headed, args.inspect, args.resume)
        if not args.inspect:
            output = args.output.resolve()
            output.parent.mkdir(parents=True, exist_ok=True)
            assemble(clips, output, voices, base, source)
            log(f"FINAL FILE: {output}\nDURATION: {duration(output):.2f} seconds")
    finally:
        if server:
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"], capture_output=True)
            else:
                server.terminate()
            stream.close()

if __name__ == "__main__":
    asyncio.run(main())
