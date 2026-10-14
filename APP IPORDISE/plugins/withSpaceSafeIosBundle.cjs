const { withXcodeProject } = require('expo/config-plugins');

function quoteBundleScript(script) {
  const fixed = script.replace(/^`([^\n`]*react-native-xcode\.sh[^\n`]*)`\s*$/m, (_line, command) => `"$(${command})"\n`);
  if (!fixed.includes('"$(') || !fixed.includes('react-native-xcode.sh')) {
    throw new Error('Cannot locate the React Native iOS bundling script; review the space-safe build plugin.');
  }
  if (/^`[^\n]*react-native-xcode\.sh/m.test(fixed)) throw new Error('React Native bundle script path is still unquoted.');
  return fixed;
}

module.exports = config => withXcodeProject(config, result => {
  const phases = result.modResults.hash.project.objects.PBXShellScriptBuildPhase;
  let found = false;
  for (const phase of Object.values(phases)) {
    if (typeof phase !== 'object' || !phase.shellScript?.includes('react-native-xcode.sh')) continue;
    const script = JSON.parse(phase.shellScript);
    phase.shellScript = JSON.stringify(quoteBundleScript(script));
    found = true;
  }
  if (!found) throw new Error('React Native iOS bundle build phase was not found.');
  return result;
});
module.exports.quoteBundleScript = quoteBundleScript;
