# Barcode scanner for OFF, live graphs slider, emulator script

- **Date:** 2026-11-06
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md); user, in chat: "implement, for both web
  and android, a barcode scanner for OFF", "a `.sh` that runs the two commands required to bootstrap the emulator for
  you", "The graphs in “Time graphs” should update live as you move the slider"

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
