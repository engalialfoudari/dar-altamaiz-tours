const appConfig = require("./app.json");

const baseUrl = process.env.EXPO_WEB_BASE_URL;

module.exports = {
  ...appConfig,
  expo: {
    ...appConfig.expo,
    experiments: {
      ...appConfig.expo.experiments,
      ...(baseUrl ? { baseUrl } : {}),
    },
  },
};