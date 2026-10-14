import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Expo SDK 54 scripts reparse an unquoted path through bash -c and split
// APP IPORDISE into two arguments. Pass the script as one argument instead.
// Keep this workaround until both Expo packages support spaces upstream.
export function patchIosBuildFile(source, kind) {
  let before;
  let after;
  if (kind === 'constants') {
    before = String.raw`:script => "bash -l -c \"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\"",`;
    after = String.raw`:script => 'bash -l "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"',`;
  } else if (kind === 'updates') {
    before = 'bash -l -c "$PODS_TARGET_SRCROOT/../scripts/create-updates-resources-ios.sh"';
    after = 'bash -l "$PODS_TARGET_SRCROOT/../scripts/create-updates-resources-ios.sh"';
  } else if (kind === 'basename') {
    before = '$(basename $PROJECT_DIR)';
    after = '$(basename "$PROJECT_DIR")';
  } else {
    throw new Error(`Unknown patch kind: ${kind}`);
  }
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Expo ${kind} script changed; review the iOS path workaround before building.`);
  return source.replace(before, after);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const [file, kind] of [
    ['expo-constants/ios/EXConstants.podspec', 'constants'],
    ['expo-updates/ios/EXUpdates.podspec', 'updates'],
    ['expo-constants/scripts/get-app-config-ios.sh', 'basename'],
    ['expo-updates/scripts/create-updates-resources-ios.sh', 'basename'],
  ]) {
    const target = new URL(`../node_modules/${file}`, import.meta.url);
    const source = readFileSync(target, 'utf8');
    const patched = patchIosBuildFile(source, kind);
    if (patched !== source) writeFileSync(target, patched);
    console.log(`Verified space-safe iOS script: ${file}`);
  }
}
