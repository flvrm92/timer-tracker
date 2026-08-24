/**
 * Renders every Windows/MSIX image asset from the single source at
 * packaging/icon.svg.
 *
 * Outputs:
 *   packaging/assets/*.png  - referenced by packaging/Package.appxmanifest.template
 *   packaging/icon.ico      - referenced by packagerConfig.icon in forge.config.js
 *
 * Run via `npm run generate-icons`. Also runs automatically before packaging,
 * so the committed art can never drift from the source SVG.
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'packaging', 'icon.svg');
const ASSETS = path.join(ROOT, 'packaging', 'assets');
const ICO = path.join(ROOT, 'packaging', 'icon.ico');

// Square tiles and logos. Names are dictated by the manifest references.
const SQUARE = {
  'StoreLogo.png': 50,
  'Square44x44Logo.png': 44,
  'Square71x71Logo.png': 71,
  'Square150x150Logo.png': 150,
  'Square310x310Logo.png': 310,
};

// Alternate sizes Windows picks between for the taskbar, Alt+Tab and Explorer.
const TARGET_SIZES = [16, 24, 32, 48, 256];

// Sizes packed into the multi-resolution .ico used for the EXE itself.
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/** Renders the source SVG to a square PNG buffer. */
function square(size) {
  return sharp(SOURCE, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

/**
 * Renders a non-square canvas (wide tile, splash screen) with the mark centred
 * and the surrounding area left transparent, so Windows composites it against
 * the tile BackgroundColor from the manifest.
 */
async function canvas(width, height, markSize) {
  const mark = await square(markSize);
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Icon source not found: ${SOURCE}`);
  }
  fs.mkdirSync(ASSETS, { recursive: true });

  const written = [];
  const write = (name, buffer) => {
    fs.writeFileSync(path.join(ASSETS, name), buffer);
    written.push(name);
  };

  for (const [name, size] of Object.entries(SQUARE)) {
    write(name, await square(size));
  }

  for (const size of TARGET_SIZES) {
    write(`Square44x44Logo.targetsize-${size}.png`, await square(size));
  }

  // Wide tile: 310x150, mark sized to the shorter edge with breathing room.
  write('Wide310x150Logo.png', await canvas(310, 150, 128));

  // Splash screen shown while the Electron main process boots.
  write('SplashScreen.png', await canvas(620, 300, 256));

  fs.writeFileSync(ICO, await pngToIco(await Promise.all(ICO_SIZES.map(square))));

  console.log(`Wrote ${written.length} assets to packaging/assets:`);
  for (const name of written.sort()) console.log(`  ${name}`);
  console.log(`Wrote packaging/icon.ico (${ICO_SIZES.join(', ')} px)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
