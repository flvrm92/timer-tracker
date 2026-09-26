/**
 * The version resolver is pure given an injected provider, so these tests need
 * no Electron mock at all.
 *
 * Every test injects the version it asserts on. Asserting the repo's current
 * 1.0.5 would turn every release bump into a red suite.
 */
const {
  APP_NAME,
  UNKNOWN,
  getVersion,
  getRuntimeVersions,
  getMenuLabel,
  formatSummary,
  buildAboutInfo,
} = require('../src/main/appVersion');

const provider = (version, versions = { electron: '41.0.2', node: '22.20.0', chrome: '140.0.0.0' }) =>
  ({ getVersion: () => version, versions });

describe('appVersion: getVersion', () => {
  test('returns the version the provider reports', () => {
    expect(getVersion(provider('2.3.4'))).toBe('2.3.4');
  });

  test('trims surrounding whitespace', () => {
    expect(getVersion(provider('  2.3.4  '))).toBe('2.3.4');
  });

  test('returns the placeholder when the provider reports nothing', () => {
    expect(getVersion(provider(undefined))).toBe(UNKNOWN);
  });

  test('returns the placeholder for an empty version', () => {
    expect(getVersion(provider('   '))).toBe(UNKNOWN);
  });

  test('returns the placeholder for a non-string version', () => {
    expect(getVersion(provider(105))).toBe(UNKNOWN);
  });

  test('does not throw when reading the version throws', () => {
    const broken = { getVersion: () => { throw new Error('no metadata'); } };
    expect(getVersion(broken)).toBe(UNKNOWN);
  });
});

describe('appVersion: getRuntimeVersions', () => {
  test('reports Electron, Node and Chromium from the provider', () => {
    expect(getRuntimeVersions(provider('1.2.3'))).toEqual({
      electron: '41.0.2',
      node: '22.20.0',
      chrome: '140.0.0.0',
    });
  });

  test('falls back to the placeholder for each missing runtime', () => {
    expect(getRuntimeVersions(provider('1.2.3', {}))).toEqual({
      electron: UNKNOWN,
      node: UNKNOWN,
      chrome: UNKNOWN,
    });
  });

  test('does not throw when the provider has no versions at all', () => {
    expect(getRuntimeVersions({}).electron).toBe(UNKNOWN);
  });
});

describe('appVersion: getMenuLabel', () => {
  test('embeds the current version in the label', () => {
    expect(getMenuLabel(provider('2.3.4'))).toBe(`About ${APP_NAME} (v2.3.4)`);
  });

  test('a later release shows the new number', () => {
    expect(getMenuLabel(provider('7.0.1'))).toContain('7.0.1');
  });

  test('renders a clearly-marked placeholder rather than throwing', () => {
    expect(getMenuLabel(provider(undefined))).toBe(`About ${APP_NAME} (version ${UNKNOWN})`);
  });

  test('never renders a bare "v" with nothing after it', () => {
    expect(getMenuLabel(provider(''))).not.toMatch(/\(v\)/);
  });
});

describe('appVersion: formatSummary', () => {
  test('is one line', () => {
    const summary = formatSummary({
      version: '2.3.4', electron: '41.0.2', node: '22.20.0', chrome: '140.0.0.0',
    });
    expect(summary).not.toContain('\n');
  });

  test('carries the app name, version and every runtime version', () => {
    const summary = formatSummary({
      version: '2.3.4', electron: '41.0.2', node: '22.20.0', chrome: '140.0.0.0',
    });
    expect(summary).toContain(APP_NAME);
    expect(summary).toContain('2.3.4');
    expect(summary).toContain('41.0.2');
    expect(summary).toContain('22.20.0');
    expect(summary).toContain('140.0.0.0');
  });
});

describe('appVersion: buildAboutInfo', () => {
  test('carries everything the popup renders', () => {
    expect(buildAboutInfo(provider('2.3.4'))).toEqual({
      appName: APP_NAME,
      version: '2.3.4',
      electron: '41.0.2',
      node: '22.20.0',
      chrome: '140.0.0.0',
      summary: formatSummary({
        version: '2.3.4', electron: '41.0.2', node: '22.20.0', chrome: '140.0.0.0',
      }),
    });
  });

  test('survives a provider with no metadata', () => {
    const info = buildAboutInfo({});
    expect(info.version).toBe(UNKNOWN);
    expect(info.summary).toContain(UNKNOWN);
  });

  test('is JSON round-trippable, because that is how it reaches the preload', () => {
    const info = buildAboutInfo(provider('2.3.4'));
    expect(JSON.parse(JSON.stringify(info))).toEqual(info);
  });
});
