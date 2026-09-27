# Perf budget

Measured 2026-09-27T08:27:46.117Z against `http://127.0.0.1:3112` (production `next start`, headless Chromium, ANGLE Metal, unthrottled).

## Timing

| Milestone | Time |
| --- | ---: |
| Entrance visible | 5586 ms |
| Scene loader gone | 6504 ms |

## Transferred bytes (by type)

| Type | Bytes |
| --- | ---: |
| document | 10.7 KB |
| js | 1689.3 KB |
| css | 201.9 KB |
| image | 3142.9 KB |
| font | 122.6 KB |
| other | 0.0 KB |
| **total** | **5167.3 KB** |

## Notes

- Network throttling via Chrome DevTools Protocol was not recorded; CDP throttling is unreliable in this headless Metal setup.
- GPU flags: `--use-angle=metal --enable-gpu --ignore-gpu-blocklist --enable-webgl`.

## After polish pass (2026-09-27)

Measured against `http://127.0.0.1:3118` after merging lanes P/U/C/W/S (production `next start`, headless Chromium, ANGLE Metal, unthrottled). SceneLoader is not mounted; “loader gone” is immediate when no `.scene-loader` node exists. “Entrance visible” is `aria-busy` clearing (scene ready / Step inside enabled).

| Metric | Measured | Budget | Status |
| --- | ---: | ---: | --- |
| Entrance visible (ready) | 2363 ms | ≤ 5 s | pass |
| Scene loader gone | 2376 ms | ≤ 5 s | pass (no loader) |
| Initial transfer | 5947.9 KB (~5.8 MB) | ≤ 2.5 MB | miss |
| JS transfer | 1785.4 KB | ≤ 450 KB gzip | miss (raw transfer; not gzip) |
| Startup images | 3642.7 KB | ≤ 1.2 MB | miss |
| Fonts | 122.6 KB | ≤ 150 KB | pass |

| Type | Bytes |
| --- | ---: |
| document | 152.0 KB |
| js | 1785.4 KB |
| css | 245.3 KB |
| image | 3642.7 KB |
| font | 122.6 KB |
| other | 0.0 KB |
| **total** | **5947.9 KB** |
