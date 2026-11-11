# Barcode scanner for OFF, live graphs slider, emulator script

- **Date:** 2026-11-06
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md); user, in chat: "implement, for both web
  and android, a barcode scanner for OFF", "a `.sh` that runs the two commands required to bootstrap the emulator for
  you", "The graphs in “Time graphs” should update live as you move the slider"

## Barcode scanner

A barcode button between the search box and Search, on both apps; a code read goes into the box and is looked up at
once (the box's own barcode lookup, `searchOff`). EAN-13, EAN-8, UPC-A, UPC-E only: what's printed on packs.

- **Web** (`ScanSheet.jsx`): the back camera in a sheet with a line to aim with; `@zxing/browser` decodes it.
  Chosen over the browser's `BarcodeDetector`, which Firefox and desktop browsers lack: one path everywhere. It's
  imported when the sheet opens, as its own ~480 kB chunk; the main bundle grew 4 kB. Camera errors (not allowed, none,
  no https) show in the sheet. Checked in headless Chromium with a fake camera drawing Nutella's EAN-13: read,
  looked up, Nutella listed.
- **Android**: zxing-android-embedded 4.3.0 (Apache 2.0, zxing core, no Play Services, so fine for F-Droid) and its
  scanner screen, which asks for the camera itself; rotation unlocked in the manifest. Not ML Kit: proprietary, Play
  Services. Not a Compose camera of our own (CameraX plus zxing core): more code for a screen that only has to read one
  code. Checked on the emulator: the camera permission prompt, the scanner, back to the search; its emulated camera
  shows no barcode, so reading one was checked on the web only. The web's zxing chunk also ends up in the APK's web
  assets, unused there.

## Time graphs: live slider

The web's range input already set the window at each step while held (checked: holding the mouse and moving left
went 1 → 5 → 8 → 11 months before letting go). The Android slider set it only when let go; it now sets it at each
stop it crosses, and views arriving while it's held don't move the thumb back. Checked on the emulator, holding a
finger and moving it: 1, 2, 3, 5, 6, 7 months as it went.

A request to make sliding the graphs move the window without changing its width was dropped: both apps already pan
without changing it (checked: a touch drag on the web, a swipe on the emulator, 30 days before and after), and the
user said never mind.

## Emulator script

`android/scripts/host-emulator.sh`, run on the laptop: the two commands given in chat until now. The emulator is
started detached (`setsid`) unless already running, inside `systemd-run --user --scope` with `MemoryMax=4G`,
`MemorySwapMax=0` (the user: it kept "tilting" the machine from startup; capped, it ran fine), `-memory 2048 -cores 2
-no-snapshot`; then `adb kill-server` and `adb -a nodaemon server start` in the foreground. Not run here (it's for
the host); syntax checked.

2026-11-11: `MemoryMax=6G`. At 4G the cgroup's OOM killer killed it 37 s in, just after "Boot completed" (journal:
`Failed with result 'oom-kill'`): the guest's 2 GB plus the emulator's own (GPU, window, netsim) went past 4 GB.
6 GB still leaves the laptop ~9 GB.

Later on 2026-11-11: the 6G cap tilted the laptop again while the user was working on something else. The cap only
bounds the emulator; 6 GB of it plus the container (same 15 GB) plus the user's apps ran the laptop out. So the
emulator now uses less instead: `-memory 1536`, `-no-window` by default (`--window` brings it back; the window and
its GPU rendering were most of what went past 4 GB), cap back to 4.5G. It refuses to start with under 6 GB
`MemAvailable`, and runs under `choom -n 1000` so the kernel's global OOM killer takes it first. Not run here (host
only); syntax checked.
