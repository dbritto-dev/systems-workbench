// Fits a machine screenshot onto a fixed 1200x800 (3:2) canvas: trims the empty stage around the
// machine, scales it to fit inside a padded box, and centres it on the stage colour.
const sharp = require('sharp');
const W = 1200, H = 800, PADX = 70, PADY = 56;
async function normalize(input) {
  const src = sharp(input);
  const { data } = await src.clone().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  const bg = { r: data[0], g: data[1], b: data[2] };
  const trimmed = await src.clone().trim({ background: bg, threshold: 6 }).toBuffer();
  const fitted = await sharp(trimmed).resize({ width: W - 2 * PADX, height: H - 2 * PADY, fit: 'contain', background: bg }).toBuffer();
  return sharp({ create: { width: W, height: H, channels: 3, background: bg } }).composite([{ input: fitted, gravity: 'centre' }]).webp({ quality: 86 });
}
module.exports = { normalize };
if (require.main === module) (async () => {
  const fs = require('fs'), path = require('path');
  for (const f of process.argv.slice(2)) {
    const out = await (await normalize(fs.readFileSync(f))).toBuffer();
    fs.writeFileSync(f, out);
    console.log('normalized', path.basename(f));
  }
})();
