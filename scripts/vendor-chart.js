/**
 * Copies the Chart.js UMD build into src/renderer/vendor/ so the dashboard can
 * load it with a plain <script src>.
 *
 * The renderer CSP is `script-src 'self'`, so the library has to be served
 * from inside the package - a CDN is blocked outright. Pointing the page at
 * node_modules/ instead would not survive packaging: Forge prunes that tree
 * and the asar path does not resolve the same way from a renderer file URL.
 *
 * Runs on postinstall and prepackage. It is a copy, not a checked-in blob, so
 * the vendored file cannot drift from the version pinned in package.json.
 */

const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.join(__dirname, '..', 'node_modules', 'chart.js', 'dist', 'chart.umd.js');
const TARGET_DIR = path.join(__dirname, '..', 'src', 'renderer', 'vendor');
const TARGET = path.join(TARGET_DIR, 'chart.umd.js');
const LICENSE_SOURCE = path.join(__dirname, '..', 'node_modules', 'chart.js', 'LICENSE.md');
const LICENSE_TARGET = path.join(TARGET_DIR, 'chart.js.LICENSE.md');

function main() {
  if (!fs.existsSync(SOURCE)) {
    // postinstall runs in contexts where the dependency tree may be absent or
    // half-built (CI cache restores, --production installs). A missing source
    // is not a reason to fail the install; the packaging run will catch it.
    console.warn(`vendor-chart: ${SOURCE} not found, skipping.`);
    return;
  }

  fs.mkdirSync(TARGET_DIR, { recursive: true });
  fs.copyFileSync(SOURCE, TARGET);

  // The MIT notice ships beside the code it covers, for the Store submission.
  if (fs.existsSync(LICENSE_SOURCE)) {
    fs.copyFileSync(LICENSE_SOURCE, LICENSE_TARGET);
  }

  const version = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'chart.js', 'package.json'), 'utf8')
  ).version;

  console.log(`vendor-chart: Chart.js ${version} -> ${path.relative(path.join(__dirname, '..'), TARGET)}`);
}

main();
