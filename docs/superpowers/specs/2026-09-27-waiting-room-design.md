# Waiting room — design

**Date:** 27 September 2026
**Status:** approved (three versions to compare)

## Job

The waiting room replaces the scene loader and the entrance "Begin" screen. The guest stands outside the tea shop while the 3D room loads. The guest reads what the project is and who made it. When the room is ready, **Step inside** opens it and the camera moves to the Counter. The dock's "Waiting room" station returns the guest outside.

## Shared base (`feature/waiting-room`)

- `src/ui/waiting-room/content.ts` — project copy and team data. One source for all versions.
- `src/ui/waiting-room/SakuraPetals.tsx` — React Three Fiber port of the ThreeUI `sakura-branch` "petals adrift" system: the same notched, cupped petal geometry, instanced fall-and-tumble vertex shader, and back-lit petal shading. Reduced motion renders one still frame.
- `src/ui/waiting-room/WaitingRoom.tsx` + `.css` — the overlay: exterior backdrop, back petal layer, brand, progress line, **Step inside** control, and the doorway exit. Versions render as its children.
- `public/images/waiting-room/` — generated exterior at dusk (open doors, noren with the house emblem, sakura), five ink-and-watercolour team portraits, and two tea-shop sketches.
- `TeaRoomShell.tsx` — `SceneLoader` and the entrance hero are removed. The waiting room is open while `station === 'Entrance'`.

## Versions (one branch each, from the base)

| Branch                            | Concept                                                                                                                                                      | Reference mechanism                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `feature/waiting-room-sketchbook` | An open sketchbook in front of the shop. Spreads: project, how it works, one spread per member, socials. One page at a time on phones.                       | Meng To sketchbook: 18-strip CSS page curl, spring, cursor tilt.                 |
| `feature/waiting-room-invitation` | One charter sheet hangs in the doorway. Front: project and five countersignatures. Back: the team. HTML handles under the sheet.                             | ThreeUI 3D Paper certificate: arc-length bend shader, drag to turn, hover light. |
| `feature/waiting-room-tanzaku`    | Five paper slips hang on a cord under the blossoms, with a parchment notice for the project. A slip comes forward on selection and shows the bio and X link. | The same bend shader on five slips, each with its own phase.                     |

## Rules

- House type only (Georgia / Iowan Old Style serif, Arial). No remote fonts or images.
- Honest copy: the thesis review is labelled as synthetic demo data. Only X accounts and the public GitHub repository are linked.
- Every canvas-drawn text also exists as real HTML (links, buttons, screen readers).
- `prefers-reduced-motion`: no parallax, still petals, crossfade exit.
- Check: `tests/browser/station-dock.spec.ts` enters through **Step inside**.
