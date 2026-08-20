import { readFile } from 'node:fs/promises';

export const validateReleaseConfig = (config, easConfig) => {
  const expo = config?.expo;
  const errors = [];
  if (!expo?.name || !expo?.slug || !expo?.version) errors.push('Expo name, slug, and version are required');
  if (!expo?.ios?.bundleIdentifier) errors.push('iOS bundleIdentifier is required');
  if (!expo?.ios?.buildNumber) errors.push('iOS buildNumber is required');
  if (!expo?.android?.package) errors.push('Android package is required');
  if (!Number.isInteger(expo?.android?.versionCode) || expo.android.versionCode < 1) errors.push('Android versionCode must be a positive integer');
  if (!expo?.icon || !expo?.splash?.image) errors.push('App icon and splash image are required');
  if (expo?.name !== 'IPORDISE') errors.push('Customer-facing app name must be IPORDISE');
  if (expo?.android?.package !== expo?.ios?.bundleIdentifier) errors.push('Android package and iOS bundle identifier must stay aligned');
  if (!expo?.android?.blockedPermissions?.includes('android.permission.READ_EXTERNAL_STORAGE') || !expo?.android?.blockedPermissions?.includes('android.permission.WRITE_EXTERNAL_STORAGE')) errors.push('Legacy Android storage permissions must be blocked');
  if (expo?.ios?.infoPlist?.NSAppTransportSecurity?.NSAllowsArbitraryLoads !== false) errors.push('iOS arbitrary HTTP loads must be disabled');
  if (easConfig) {
    if (easConfig?.cli?.appVersionSource !== 'remote') errors.push('EAS must remain the single source for store build numbers');
    if (easConfig?.build?.production?.distribution !== 'store') errors.push('Production EAS distribution must be store');
    if (easConfig?.build?.production?.android?.buildType !== 'app-bundle') errors.push('Production Android artifact must be an App Bundle');
    if (easConfig?.build?.production?.environment !== 'production') errors.push('Production EAS profile must use the production environment');
  }
  return errors;
};

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  const config = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8'));
  const easConfig = JSON.parse(await readFile(new URL('../eas.json', import.meta.url), 'utf8'));
  const errors = validateReleaseConfig(config, easConfig);
  if (errors.length) {
    console.error(errors.map(error => `- ${error}`).join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Release configuration is complete.');
  }
}
