// Every quality number for the 3D stage, in one pure place. Phones get a lighter tier; scene.js and scene-look.js only read it.
// reducedMotion is accepted so later slices (bloom, traffic counts) can key off it; nothing here animates, so today it changes no number.
const DESKTOP = { shadowSize: 2048, pixelRatio: 2, cloudCount: 6, windowCell: 32, softShadows: true };
const PHONE = { shadowSize: 1024, pixelRatio: 1.5, cloudCount: 3, windowCell: 16, softShadows: false };

export function tierFor({ phone = false } = {}) {
  return { ...(phone ? PHONE : DESKTOP) };
}
