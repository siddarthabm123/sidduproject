# Recorded demo verification — 19 November 2026

- Final file: `rigdesk-judge-demo.mp4` in this directory.
- Duration: **90.00 seconds**.
- Resolution / frame rate: **1920×1080 / 30 fps**.
- Format: H.264 video, AAC stereo audio, fast-start MP4.
- File size: **6,888,669 bytes** (approximately 6.57 MiB).
- Narration: **en-IN-PrabhatNeural**, five individually fitted chapters. The system voice fallback was not used.
- Captions: embedded sentence-level captions with section-synchronized timing.
- Evidence: active source inventory contains **92 TSX files and 39 literal route declarations**. Browser checks opened **27 public/customer/owner pages**, including all three pitch anchors, with HTTP 200 and no uncaught JavaScript errors.
- Fourteen scenes were recorded from actual isolated demo browser sessions. The explicitly labelled closing business-model card is presentation content.
- **The complete exported MP4 decoded without errors.** Narration was checked for non-silence; mean level was approximately −19.6 dB, with no detected clipping in the checked export.
- A contact sheet of the exported frames was visually reviewed. The recording demonstrates equipment discovery, a three-unit allocation across two owners, bid sorting, quote/reserve examples, booking/bond records, fuel vouchers and sample bills, workforce hiring/negotiation, and owner operations.

The app source used for the recording was commit `a9fdc306f183cc1f4237c3131c95620fb13d3f75`. No production database update, real employment request, payment or fuel redemption was submitted. Recordings and temporary browser files are on `D:/RigDesk-Demo-20261118/artifacts` because the system drive ran out of space during setup. The final MP4 is copied/generated in the project directory above; media, the Python environment and temporary recordings are excluded from Git and Vercel uploads. Run the generator to recreate them.

An earlier export was 89.93 seconds. The final exporter pads audio/video and trims both to 90 seconds; the verified project-folder MP4 is the final 90.00-second version.
