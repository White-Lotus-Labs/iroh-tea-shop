# Project status

**Updated:** 24 September 2026  
**Phase:** PASS A, a local interactive demo  
**Review state:** Implementation is open in [pull request #1](https://github.com/White-Lotus-Labs/iroh-tea-shop/pull/1) from `pass-a-mvp` into `main`. The site has not been deployed.

Tea After Pour currently demonstrates the complete intended _room journey_ with synthetic review data. It is ready to run and review locally. It is not yet a live thesis-analysis service: no market-data provider, LLM, account system, database, or public sharing service is connected.

## What is implemented

- **Five-stage visitor journey.** The site opens at the counter in a waiting room. Visitors can also visit the waiting-room introduction, then move to the tea table, host, and shelf. A valid pour moves the camera through the doorway into the tea room; visitors can revisit stations and reset the view.
- **Cinematic 3D setting.** Two connected Japanese tea-shop rooms fill the browser window. The counter, doorway, floor, tea table, teapot, cups, rug, seated 3D grandfather, and decorated right-wall shelf are rendered in one Three.js scene. Locally bundled wall and character textures provide the room's visual detail. The host's face, beard, robe, and body are curved or volumetric 3D surfaces, with restrained breathing motion.
- **Tea and camera motion.** Authored camera positions frame each station. Room-to-room travel uses eased motion through the actual doorway. A pour briefly tips the teapot, shows a stream and steam, and changes the room's light. Motion can follow the operating system preference, be reduced, or be explicitly enabled.
- **Thesis and review flow.** Visitors enter 80–6,000 characters, confirm a symbol and review window, and can load the prepared ETH sample. The sample at 24 hours receives a fixed synthetic **NOTICED / CUT / ONE BREATH** review and an inspectable evidence receipt. Other valid input is explicitly marked **unknown / unassessed** with no linked evidence. Every result is labeled **DEMO DATA**.
- **Reflection and card preview.** The host presents a one-breath question. The shelf shows a card containing only application-owned reflection text and demo provenance; it does not copy the complete thesis or wallet details. The card is a preview, not an export or a public post.
- **Resilience and accessibility.** Duplicate pours are blocked. Cancellation, validation errors, retries, rapid navigation, and stale responses preserve the user's writing and keep the active result consistent. Keyboard navigation, accessible form labels, an evidence dialog, reduced motion, a responsive mobile layout, and a WebGL fallback keep the core journey usable without the 3D view.
- **Current panel layout.** On desktop, the room-stage reading panels share a footprint of about 72% of viewport width by 65% of viewport height; mobile uses compact, scrollable panels.

## Verification snapshot

The project has passed `npm run typecheck`, `npm run format:check`, `npm test` (11 unit tests), `npm run test:e2e` (7 Chromium browser tests), and `npm run build`. The browser suite covers the complete ritual, input preservation, cancellation, station navigation, motion preferences, mobile layout, and WebGL fallback. These are local checks; they are not a claim of production performance or cross-browser certification.

## Current boundaries

- The prepared ETH evidence is an invented, fixed teaching fixture dated **22 September 2026 at 18:00 UTC**. It is not current market activity. PASS A does not analyze arbitrary theses or resolve symbols against a live registry.
- Input and results live only in browser memory and disappear on reload. There are no user accounts, analytics, database, or persistence.
- The grandfather is an authored 3D character with image textures, not a scanned or fully rigged person. Visitors can make small local camera adjustments but cannot freely walk around the rooms.
- Performance depends on the device's GPU. The automated browser checks use Chromium; Safari and Firefox have not been separately verified.
- The card has no image, clipboard, or social export. No public site has been deployed.

## Work remaining for a live product

PASS B would need a server-side integration for real evidence and any LLM use, protected credentials and request limits, live symbol resolution, grounded claim extraction, explicit partial-data handling, and a truthful distinction between sourced findings and unknowns. Persistence, accounts, full card export, hosting, broader browser/performance checks, and release work are also outside the current demo. The existing `ReviewAdapter` contract is the seam for replacing the mock review without rebuilding the room journey.

For setup and a detailed walkthrough, see the [README](../README.md). The scene lives in `src/scene/`, user interface in `src/ui/`, review behavior in `src/review/`, and synthetic fixture in `src/fixtures/`.
