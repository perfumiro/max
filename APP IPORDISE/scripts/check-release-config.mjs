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
  if (!expo?.android?.blockedPermissions?.includes('android.permission.USE_BIOMETRIC') || !expo?.android?.blockedPermissions?.includes('android.permission.USE_FINGERPRINT')) errors.push('Unused biometric permissions from SecureStore must be blocked');
  if (expo?.android?.allowBackup !== false) errors.push('Android application backups must be disabled for customer data protection');
  if (expo?.android?.softwareKeyboardLayoutMode !== 'resize') errors.push('Android checkout requires resize keyboard layout mode so its ScrollView is the only focus-scrolling surface');
  if (expo?.androidStatusBar?.translucent !== false) errors.push('Android checkout requires a non-translucent status bar for stable resize keyboard insets');
  if (new Set(expo?.android?.blockedPermissions || []).size !== (expo?.android?.blockedPermissions || []).length) errors.push('Android blocked permissions must not contain duplicates');
  if (expo?.ios?.infoPlist?.NSAppTransportSecurity?.NSAllowsArbitraryLoads !== false) errors.push('iOS arbitrary HTTP loads must be disabled');
  const projectId = expo?.extra?.eas?.projectId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId || '')) errors.push('A valid existing EAS project ID is required');
  if (expo?.updates?.url !== `https://u.expo.dev/${projectId}`) errors.push('EAS Update URL must match the linked project ID');
  if (expo?.updates?.checkAutomatically !== 'ON_LOAD') errors.push('Installed apps must check for EAS updates on launch');
  if (!Number.isInteger(expo?.updates?.fallbackToCacheTimeout) || expo.updates.fallbackToCacheTimeout < 5000) errors.push('Installed apps must allow the production update to load on first launch');
  if (expo?.runtimeVersion?.policy !== 'appVersion') errors.push('Runtime version must use the appVersion policy');
  if (easConfig) {
    if (easConfig?.cli?.appVersionSource !== 'remote') errors.push('EAS must remain the single source for store build numbers');
    if (easConfig?.build?.production?.distribution !== 'store') errors.push('Production EAS distribution must be store');
    if (easConfig?.build?.production?.android?.buildType !== 'app-bundle') errors.push('Production Android artifact must be an App Bundle');
    if (easConfig?.build?.production?.environment !== 'production') errors.push('Production EAS profile must use the production environment');
    if (easConfig?.build?.['production-apk']?.distribution !== 'internal') errors.push('Downloadable production APK must use internal distribution');
    if (easConfig?.build?.['production-apk']?.android?.buildType !== 'apk') errors.push('Downloadable production Android artifact must be an APK');
    if (easConfig?.build?.['production-apk']?.environment !== 'production') errors.push('Downloadable production APK must use the production environment');
    if (easConfig?.build?.['production-apk']?.channel !== 'production') errors.push('Downloadable production APK must use the production update channel');
    for (const profile of ['development', 'preview', 'production']) {
      if (easConfig?.build?.[profile]?.channel !== profile) errors.push(`${profile} EAS profile must use the ${profile} update channel`);
      if (easConfig?.build?.[profile]?.environment !== profile) errors.push(`${profile} EAS profile must use the ${profile} environment`);
    }
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
