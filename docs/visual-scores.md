# Visual scores

Scores follow `docs/visual-rubric.md`. Shots come from the headed Metal run (1600×900 at 2x) unless a row says otherwise. Shot folders are under `/Users/jackie/dev/tea-wt/_scratch/shots/`.

Frame rate is uncapped (no vsync) on an Apple M5 Max. "Min fps" is the slowest shot.

## Round 0 (baseline)

Shots: `_scratch/shots/round-0`. Frame rate: mean 296 fps, min 229 fps (`counter`).

| Part                   | Score | Reason                                                                                          |
| ---------------------- | ----- | ----------------------------------------------------------------------------------------------- |
| Lighting and shadows   | 4     | Heavy ambient and hemisphere fill flatten every form; one hard sun shadow; the tea set floats.  |
| Environment/atmosphere | 3     | No ceiling (grey beam undersides over a void); no haze or depth; the left wall is a black void. |
| Walls/architecture     | 4     | Painted backdrops read as flat stickers; left and waiting-room walls are blank plaster boxes.   |
| Floor and table        | 4     | Uniform orange planks with painted-on dark strips; pale pine table box; tatami are flat slabs.  |
| Tea set and steam      | 4     | Good teapot silhouette, but no contact shadow, flat dark tea, and the steam is invisible.       |
| Orrery                 | 5     | Rich mechanism, but the brass reflects nothing and reads as yellow plastic on a black wall.     |
| Mood/color grade       | 4     | One-note orange-brown, low contrast, no bloom on lanterns; 3D and painted layers do not match.  |

Host baseline (host lane owns these; scene lane does not edit them):

| Part    | Score | Reason                                                                  |
| ------- | ----- | ----------------------------------------------------------------------- |
| Face    | 5     | Strong photo skin, but it sits on a sphere with primitive ears.         |
| Eyes    | 5     | Painted into the photo; no wet highlight or depth.                      |
| Beard   | 6     | Good strand texture, but a flat card with a hard outline.               |
| Hair    | 3     | A grey helmet band with ribbed side pieces; the topknot is two spheres. |
| Hands   | 3     | Pale mitten shapes; the tone does not match the face.                   |
| Robe    | 6     | Good woven texture and layered collar; the sleeves are blobs.           |
| Posture | 4     | Symmetric and stiff; the raised left hand floats in the air.            |

GPU check: headless SwiftShader and headed Metal `room-wide` at 1x differ by a mean 0.14/255. Metal is the scoring renderer.

## Round 1: effects, lighting, architecture, surfaces

Shots: `_scratch/shots/round-1`. Frame rate: mean 101 fps, min 79 fps (`room-wide`).

Changes: `SceneEffects` (Lightformer environment, exp fog, 4x MSAA composer, half-res GTAO, bloom, grade and vignette), less ambient fill, warm key and cool fill, procedural colour/normal/roughness maps with world-scale UVs, board ceiling, framed left wall with scroll and andon, plank floor, tatami, walnut table and runner, paper lanterns, noren, darker orrery brass without emissive.

| Part                   | Score | Reason                                                                                                                                 |
| ---------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Lighting and shadows   | 6     | Lanterns now motivate the light and IBL shapes forms, but lanterns clip white, the host is over-lit orange, the counter room is murky. |
| Environment/atmosphere | 6     | The room is closed and fog adds depth, but there is no haze or window light, and the left foreground falls to black.                   |
| Walls/architecture     | 6     | Posts, rails, wainscot and ceiling battens read well; plaster relief is lumpy up close; backdrops are still unlit.                     |
| Floor and table        | 7     | Planks vary in tone and grain with a soft sheen; tatami read as woven; the walnut table is too noisy up close.                         |
| Tea set and steam      | 4     | Unchanged: no contact shadow under the pot and cups, flat tea, and no visible steam.                                                   |
| Orrery                 | 6     | Brass reads as metal against the pale scroll, but the andon clutters behind it and it has no contact shadow.                           |
| Mood/color grade       | 6     | Warm, contrasty and cinematic, but saturated orange on skin and white-clipped lanterns cheapen it.                                     |

## Round 2: tea set, steam, contact shadows, lantern balance

Shots: `_scratch/shots/round-2`. Frame rate: mean 92 fps, min 73 fps (`tea-set`, full motion with steam).

Changes: glazed ceramics with clearcoat, amber tea with a glossy surface, torn-wisp steam sprites from spout, lid and cups, `ContactShadows` under the tea set and the orrery, ribbed chochin lanterns at a lower emissive, smoother plaster and finer floor grain.

| Part                   | Score | Reason                                                                                                                            |
| ---------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------- |
| Lighting and shadows   | 7     | Lanterns glow without clipping and key shadows rake the counter floor, but lanterns cast no light pools and the counter is murky. |
| Environment/atmosphere | 6     | Fog gives depth, but the glowing shoji throw no light shafts and the air has no haze or dust.                                     |
| Walls/architecture     | 6     | The frame, wainscot and ceiling read well, but the right plaster wall reads as blotchy rusted metal.                              |
| Floor and table        | 7     | Floor and tatami hold up; the table top grain is stringy and aliased in the tea-set close-up.                                     |
| Tea set and steam      | 6     | Grounded by contact shadows, with glossy glaze and visible steam, but the uniform green glaze still reads as plastic.             |
| Orrery                 | 7     | Brass rings, planets and the glowing sun read clearly against the scroll; the dial face is flat and the andon clutters.           |
| Mood/color grade       | 7     | Warm dusk grade with controlled highlights; the palette lacks a cool counterpoint, so every view is orange-brown.                 |

## Round 3: merge of origin/main (Andrii's doorway and host diorama)

Shots: `_scratch/shots/round-3-merge`. Frame rate: mean 72 fps, min 47 fps (`room-wide`). These numbers are not comparable: another lane ran a headless Playwright job at about 635% CPU during the capture.

Changes: Andrii's `TeaHouseDoorway` (jamb posts, lattice ranma transom, side shoji, green noren, jamb lantern) replaces the old partition wall and my noren. The host diorama arrives from the host lane. No scene-lane art changes.

The new part "Prop and architecture detail" starts in this round (see the rubric).

| Part                         | Score | Reason                                                                                                                  |
| ---------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------- |
| Lighting and shadows         | 7     | Unchanged. The doorway lantern adds a motivated warm pool at the counter.                                               |
| Environment/atmosphere       | 6     | Unchanged: no light shafts, haze, or dust.                                                                              |
| Walls/architecture           | 6     | The doorway frame and transom fix the blank counter partition, but the right plaster wall still reads as rusted metal.  |
| Floor and table              | 7     | Unchanged.                                                                                                              |
| Tea set and steam            | 6     | Unchanged.                                                                                                              |
| Orrery                       | 7     | Unchanged.                                                                                                              |
| Mood/color grade             | 7     | Unchanged.                                                                                                              |
| Prop and architecture detail | 4     | The counter and table are plain boxes, the pot is primitives, and painted backdrops hold the shoji, alcove, and plants. |

## Round 4: sculpted props, walls, light shafts

Shots: `_scratch/shots/round-4` (headless Metal from here on). Frame rate: mean 92 fps, min 70 fps (`counter`).

Changes: code-sculpted back wall (veranda with deck and railing, painted landscape kept only as a distant matte, lattice shoji, tokonoma with a calligraphy scroll), a framed right wall with a kumiko shoji in place of its painting, and neutral clay plaster. Veranda and shoji light shafts with dust motes (NaN-guarded). A lathe teapot with lid gallery, knob, hollow spout, and glaze break, cups with foot rings, and a tray, caddy, and scoop. A joined walnut table with tapered legs and a fringed runner. A hibachi brazier with ember charcoal and a hobnailed tetsubin. A framed counter with slats, canisters, a whisk, and a tray of cups. Back-bar shelving with labelled jars, a bonsai, bamboo, a tufted zabuton, a carved kanban signboard, and a customer-side lantern.

| Part                         | Score | Reason                                                                                                              |
| ---------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------- |
| Lighting and shadows         | 7     | The brazier glow and veranda shafts add motivated light, but the counter front and the tokonoma stay dim.           |
| Environment/atmosphere       | 7     | Shafts and motes read well behind the orrery and on the veranda; in the wide view they are almost invisible.        |
| Walls/architecture           | 7     | Real shoji, veranda and alcove replace the painted walls; the side-wall plaster panels are large and blank.         |
| Floor and table              | 7     | The joined walnut table and runner read as crafted; the table grain is still a little loud in close-up.             |
| Tea set and steam            | 7     | A sculpted pot, cups, tray and kettle with steam; the glaze needs more highlight breakup to reach a food-shot look. |
| Orrery                       | 8     | Brass glints against the dusk veranda, with a light pool, motes behind it and a contact shadow.                     |
| Mood/color grade             | 7     | The purple dusk through the veranda gives a cool counterpoint; the counter view is still murky.                     |
| Prop and architecture detail | 7     | Every prop the camera sees now has parts; the tokonoma and side walls are sparse, and the brazier box is plain.     |

## Round 5: counter light, tokonoma, brazier fittings

Shots: `_scratch/shots/round-5`. Frame rate: mean 85 fps, min 68 fps (`counter`).

Changes: a customer-side chochin that lights the counter front, a brighter tokonoma with a bronze koro, stronger shoji shafts, brass corners and ring pulls on the brazier box, and a sumi-e bamboo scroll on the left wall. The counter menu board moved to face the lantern.

| Part                         | Score | Reason                                                                                                |
| ---------------------------- | ----- | ----------------------------------------------------------------------------------------------------- |
| Lighting and shadows         | 8     | Every station now has a motivated key: lanterns, shoji, brazier embers, and the tokonoma downlight.   |
| Environment/atmosphere       | 7     | Shafts read on the veranda and behind the orrery; the wide view still shows little haze.              |
| Walls/architecture           | 7     | Joinery, shoji and alcove read as built; side-wall plaster stays deliberately plain.                  |
| Floor and table              | 7     | No change.                                                                                            |
| Tea set and steam            | 7     | No change.                                                                                            |
| Orrery                       | 8     | No change.                                                                                            |
| Mood/color grade             | 8     | The counter is no longer murky; warm interior against the violet dusk is consistent across all shots. |
| Prop and architecture detail | 7     | The brazier and tokonoma gained parts; small props are still sparse at wide framing.                  |

## Proposed

Items that need an off-limits file, a dependency, or a big architecture change.
