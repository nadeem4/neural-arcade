// Every quality number for the 3D stage, in one pure place. Phones get a lighter tier; scene.js and scene-look.js only read it.
// reducedMotion is accepted so later slices (bloom, traffic counts) can key off it; nothing here animates, so today it changes no number.
// peopleDrawn is how many of the baked people (people.js POPULATION, the same on every device) are drawn; the city score never depends on it.
// laneDashes and arrows (dashed lane lines, one-way arrows on the street) are left out on phones. facadeDetail (2 adds floor slab lines and a faint tint per floor, 1 is windows only) and roofBoxes (rooftop boxes on big flat roofs) are the building detail.
const DESKTOP = { shadowSize: 2048, pixelRatio: 2, cloudCount: 6, facadeDetail: 2, roofBoxes: true, softShadows: true, laneDashes: true, arrows: true, peopleDrawn: 60 };
const PHONE = { shadowSize: 1024, pixelRatio: 1.5, cloudCount: 3, facadeDetail: 1, roofBoxes: false, softShadows: false, laneDashes: false, arrows: false, peopleDrawn: 24 };

export function tierFor({ phone = false } = {}) {
  return { ...(phone ? PHONE : DESKTOP) };
}
