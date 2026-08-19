const fs = require('node:fs');
const path = require('node:path');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const pkg = require('./package.json');
const identity = require('./packaging/identity.json');

const PACKAGING = path.join(__dirname, 'packaging');
const MANIFEST_TEMPLATE = path.join(PACKAGING, 'Package.appxmanifest.template');
const MANIFEST = path.join(PACKAGING, 'Package.appxmanifest');

/**
 * Widens package.json's three-part semver to the four-part version the Store
 * requires. The fourth section is reserved for Store use and must be 0, and
 * the first section cannot be 0.
 *
 * This keeps package.json as the single source of truth for the version, which
 * is what prevents the drift the repo used to have (package.json 1.0.0 vs the
 * Squirrel maker's hardcoded 0.0.1).
 */
function storeVersion(semver) {
  const [major, minor, patch] = semver.split('-')[0].split('.');
  if (Number(major) === 0) {
    throw new Error(
      `MSIX rejects a leading 0 in the version. package.json version is "${semver}"; bump it to at least 1.0.0.`
    );
  }
  return `${Number(major)}.${Number(minor)}.${Number(patch)}.0`;
}

/**
 * Renders packaging/Package.appxmanifest from the template plus
 * packaging/identity.json and the package.json version. Runs at config load,
 * so every `electron-forge` invocation packages a manifest that matches the
 * current version - there is no separate step to forget.
 */
function writeManifest() {
  const version = storeVersion(pkg.version);
  const substitutions = {
    IDENTITY_NAME: identity.identityName,
    PUBLISHER: identity.publisher,
    PUBLISHER_DISPLAY_NAME: identity.publisherDisplayName,
    DISPLAY_NAME: identity.displayName,
    DESCRIPTION: identity.description,
    VERSION: version,
  };

  let manifest = fs.readFileSync(MANIFEST_TEMPLATE, 'utf8');
  for (const [key, value] of Object.entries(substitutions)) {
    if (!value) throw new Error(`packaging/identity.json is missing a value for ${key}`);
    manifest = manifest.replaceAll(`{{${key}}}`, value);
  }

  const unresolved = manifest.match(/{{[A-Z_]+}}/g);
  if (unresolved) {
    throw new Error(`Unresolved manifest placeholders: ${[...new Set(unresolved)].join(', ')}`);
  }

  fs.writeFileSync(MANIFEST, manifest);
  console.log(
    `[msix] manifest: ${identity.identityName} / ${identity.publisher} / ${version}`
  );
  return version;
}

const version = writeManifest();

/**
 * Picks which Windows SDK build the MSIX maker should take makeappx/makepri/
 * signtool from.
 *
 * This has to be set explicitly. Left unset, electron-windows-msix derives the
 * SDK version from the manifest's TargetDeviceFamily MinVersion - which is
 * 10.0.17763.0, the oldest Windows we support, not an SDK anybody installs -
 * and then fails hard instead of falling back to an installed one.
 *
 * Resolving it from disk keeps the build working across machines with different
 * SDKs. Override with WINDOWS_KIT_VERSION when a specific build is needed.
 *
 * @returns {string|undefined} SDK version folder name, or undefined if none is
 *   installed, in which case the maker reports the missing tooling itself.
 */
function resolveWindowsKitVersion() {
  if (process.env.WINDOWS_KIT_VERSION) return process.env.WINDOWS_KIT_VERSION;

  const binRoot = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
  if (!fs.existsSync(binRoot)) return undefined;

  const arch = process.env.PROCESSOR_ARCHITECTURE === 'ARM64' ? 'arm64' : 'x64';

  // Newest first, comparing the four numeric sections rather than as strings so
  // 10.0.9 does not sort above 10.0.26100.
  const rank = (name) => name.split('.').map(Number);
  const newestFirst = (a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    for (let i = 0; i < 4; i++) {
      if (ra[i] !== rb[i]) return rb[i] - ra[i];
    }
    return 0;
  };

  return fs
    .readdirSync(binRoot)
    .filter((name) => /^10(\.\d+){3}$/.test(name))
    .filter((name) => fs.existsSync(path.join(binRoot, name, arch, 'makeappx.exe')))
    .sort(newestFirst)[0];
}

const windowsKitVersion = resolveWindowsKitVersion();
console.log(`[msix] windows sdk: ${windowsKitVersion || 'NOT FOUND - install the Windows SDK'}`);

module.exports = {
  packagerConfig: {
    asar: true,
    icon: path.join(PACKAGING, 'icon'), // Forge appends the .ico extension
    // Keep development-only and packaging-only material out of the shipped app.
    // Without this the ASAR carries #specs/, the test suite and coverage output.
    ignore: [
      /^\/#specs($|\/)/,
      /^\/tests($|\/)/,
      /^\/coverage($|\/)/,
      /^\/packaging($|\/)/,
      /^\/scripts($|\/)/,
      /^\/out($|\/)/,
      /^\/\.vscode($|\/)/,
      /^\/\.github($|\/)/,
      /^\/jest\.config\.js$/,
      /^\/forge\.config\.js$/,
      /\.md$/,
    ],
    win32metadata: {
      CompanyName: identity.publisherDisplayName,
      FileDescription: identity.displayName,
      ProductName: identity.displayName,
      OriginalFilename: 'time-tracker.exe',
    },
    // NOTE: deliberately no `name` override. Renaming the Electron app would
    // change app.getName() and therefore app.getPath('userData'), orphaning
    // every existing timers.db. The friendly "Timer Tracker" name lives only in
    // the MSIX manifest and the Store listing.
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-msix',
      config: {
        appManifest: MANIFEST,
        packageAssets: path.join(PACKAGING, 'assets'),
        packageName: `timer-tracker-${pkg.version}`,
        windowsKitVersion,
        createPri: true,
        // The Store re-signs submitted MSIX packages with a Microsoft
        // certificate, so the artifact we upload must not be signed here. For
        // local sideload testing, sign a copy with scripts/sign-local.ps1.
        sign: false,
        logLevel: process.env.MSIX_DEBUG ? 'debug' : undefined,
      },
    },
  ],
  plugins: [
    // Keeps node_sqlite3.node out of the ASAR. Required: under MSIX the install
    // root is read-only, which is fine for loading a .node file, but only if it
    // is not trapped inside the archive.
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
