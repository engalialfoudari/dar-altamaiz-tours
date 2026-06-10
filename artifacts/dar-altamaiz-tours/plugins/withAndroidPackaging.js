const { withAppBuildGradle } = require('expo/config-plugins');

const EXCLUSION = 'META-INF/versions/9/OSGI-INF/MANIFEST.MF';

module.exports = function withAndroidPackaging(config) {
  return withAppBuildGradle(config, (config) => {
    const { contents } = config.modResults;
    if (contents.includes(EXCLUSION)) {
      return config;
    }
    const packagingBlock = `    packagingOptions {
        exclude '${EXCLUSION}'
    }\n`;
    config.modResults.contents = contents.replace(
      /(\bandroid\s*\{)/,
      `$1\n${packagingBlock}`
    );
    return config;
  });
};
