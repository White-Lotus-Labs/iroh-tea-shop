const THESES = ['robinhood', 'bullrun', 'ai'];

/** Every texture the room waits for before Step inside (BackWall, TeaHost3D, ThesisCards). */
export function roomTextures(light: boolean) {
  const cover = light ? '360w' : '600w';
  return [
    '/images/tea-back-wall.bbdb12.webp',
    '/images/tea-host-diorama-body.5c7c91.webp',
    '/images/tea-host-diorama-body-normal.07c541.webp',
    '/images/tea-host-diorama-head.47063b.webp',
    '/images/tea-host-diorama-head-normal.79d02a.webp',
    ...THESES.map((id) => `/images/theses/${id}-${cover}.webp`),
  ];
}
