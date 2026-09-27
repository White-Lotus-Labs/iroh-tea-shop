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

## Proposed

Items that need an off-limits file, a dependency, or a big architecture change.
