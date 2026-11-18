// Every quality number for the 3D stage, in one pure place. Phones get a lighter tier; scene.js and scene-look.js only read it.
// reducedMotion is accepted so later slices (bloom, traffic counts) can key off it; nothing here animates, so today it changes no number.
// facadeDetail (2 adds floor slab lines and a faint tint per floor, 1 is windows only) and roofBoxes (rooftop boxes on big flat roofs) are the building detail.
const DESKTOP = { shadowSize: 2048, pixelRatio: 2, cloudCount: 6, facadeDetail: 2, roofBoxes: true, softShadows: true };
const PHONE = { shadowSize: 1024, pixelRatio: 1.5, cloudCount: 3, facadeDetail: 1, roofBoxes: false, softShadows: false };

export function tierFor({ phone = false } = {}) {
  return { ...(phone ? PHONE : DESKTOP) };
}
