const { withGradleProperties } = require('@expo/config-plugins');

module.exports = function withNewArch(config) {
  return withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => item.key !== 'newArchEnabled'
    );
    config.modResults.push({
      type: 'property',
      key: 'newArchEnabled',
      value: 'true',
    });
    return config;
  });
};
