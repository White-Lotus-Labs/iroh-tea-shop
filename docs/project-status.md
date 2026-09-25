# Project status

**Updated:** 25 September 2026

**Phase:** PASS A thesis demo with a separate live Iroh research chat

**Review state:** Local feature branch `feature/iroh-nansen-chat`. The site has not been deployed.

Tea After Pour demonstrates the complete intended _room journey_ with synthetic thesis-review data. Iroh at the Host has a separate live Nansen Research Agent chat when `NANSEN_API_KEY` is configured. The thesis review is not a live analysis service. Optional nickname/password accounts and SQLite-backed sessions provide stable identity; guests can also use the room and Iroh chat. There is no public sharing service.

## What is implemented

- **Five-stage visitor journey.** The site opens at the counter in a waiting room. Visitors can also visit the waiting-room introduction, then move to the tea table, host, and shelf. A valid pour moves the camera through the doorway into the tea room; visitors can revisit stations and reset the view.
- **Cinematic 3D setting.** Two connected Japanese tea-shop rooms fill the browser window. The counter, doorway, floor, tea table, teapot, cups, rug, seated 3D grandfather, and decorated right-wall shelf are rendered in one Three.js scene. Locally bundled wall and character textures provide the room's visual detail. The host's face, beard, robe, and body are curved or volumetric 3D surfaces, with restrained breathing motion.
- **Tea and camera motion.** Authored camera positions frame each station. Room-to-room travel uses eased motion through the actual doorway. A pour briefly tips the teapot, shows a stream and steam, and changes the room's light. Motion can follow the operating system preference, be reduced, or be explicitly enabled.
- **Thesis and review flow.** Visitors enter 80–6,000 characters, confirm a symbol and review window, and can load the prepared ETH sample. The sample at 24 hours receives a fixed synthetic **NOTICED / CUT / ONE BREATH** review and an inspectable evidence receipt. Other valid input is explicitly marked **unknown / unassessed** with no linked evidence. Every result is labeled **DEMO DATA**.
- **Reflection and card preview.** The host presents a one-breath question. The shelf shows a card containing only application-owned reflection text and demo provenance; it does not copy the complete thesis or wallet details. The card is a preview, not an export or a public post.
- **Optional accounts.** Guests enter the room directly. Login and signup are available from the top-right corner; signed-in users see their nickname there and can log out. Account identity persists across refreshes, while guest activity remains in browser memory.
- **Iroh research chat.** Ask Iroh opens a Host-only chat. The browser calls a server route that uses the server-side Nansen key and streams Research Agent fast-mode events. A returned conversation ID links follow-ups. Stop and New conversation control the in-memory session. Nansen failure produces an error, never a synthetic answer.
- **Resilience and accessibility.** Duplicate pours are blocked. Cancellation, validation errors, retries, rapid navigation, and stale responses preserve the user's writing and keep the active result consistent. Keyboard navigation, accessible form labels, an evidence dialog, reduced motion, a responsive mobile layout, and a WebGL fallback keep the core journey usable without the 3D view.
- **Current panel layout.** On desktop, the thesis reading panels use about 72% of viewport width. The narrower Iroh chat sits to the right of the visible host; mobile uses a readable, scrollable chat panel.

## Verification snapshot

The prior PASS A verification covered typecheck, formatting, unit tests, Chromium browser journeys, and build. Iroh adds route, SSE, session, and browser-flow tests. Automated checks use a simulated Nansen HTTP upstream; a real-key live call still requires local manual verification. These checks are not a claim of production performance or cross-browser certification.

## Current boundaries

- The prepared ETH evidence is an invented, fixed teaching fixture dated **22 September 2026 at 18:00 UTC**. It is not current market activity. PASS A does not analyze arbitrary theses or resolve symbols against a live registry.
- Input and results live only in browser memory and disappear on reload. Iroh's Nansen conversation ID also remains only in memory. Only accounts and sessions persist in the local SQLite database; reviews and Iroh conversations are not saved. There is no analytics or chat history.
- The grandfather is an authored 3D character with image textures, not a scanned or fully rigged person. Visitors can make small local camera adjustments but cannot freely walk around the rooms.
- Performance depends on the device's GPU. The automated browser checks use Chromium; Safari and Firefox have not been separately verified.
- The card has no image, clipboard, or social export. No public site has been deployed.

## Work remaining for a live product

PASS B would need live evidence for the thesis review, live symbol resolution, grounded claim extraction, explicit partial-data handling, and a truthful distinction between sourced findings and unknowns. Persistent review and chat history, full card export, hosting, broader browser/performance checks, and release work are also outside the current demo. The existing `ReviewAdapter` contract is the seam for replacing the mock review without rebuilding the room journey; Iroh chat is a separate capability.

For setup and a detailed walkthrough, see the [README](../README.md). The scene lives in `src/scene/`, user interface in `src/ui/`, review behavior in `src/review/`, and synthetic fixture in `src/fixtures/`.
