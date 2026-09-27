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
