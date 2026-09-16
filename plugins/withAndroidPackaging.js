const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

const EXCLUSION = 'META-INF/versions/9/OSGI-INF/MANIFEST.MF';

module.exports = function withAndroidPackaging(config) {
  config = withGradleProperties(config, (config) => {
    const optimizationProperties = {
      'android.enableMinifyInReleaseBuilds': 'true',
      'android.enableShrinkResourcesInReleaseBuilds': 'true',
    };
    config.modResults = config.modResults.filter(
      (item) => !(item.key in optimizationProperties)
    );
    for (const [key, value] of Object.entries(optimizationProperties)) {
      config.modResults.push({ type: 'property', key, value });
    }
    return config;
  });

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
