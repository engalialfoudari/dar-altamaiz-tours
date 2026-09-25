# Android release preparation

This branch is a snapshot of the current Replit mobile app and its two shared packages. The GitHub main branch was not changed.

No OTA is sent by creating this branch. Link this repository to the matching Expo project in Expo project settings (GitHub), then use the manual Expo Workflows on this branch. There are no automatic push triggers.

The latest local Play Store AAB is version 1.0.4, while this source is 1.0.5. The app-version runtime policy means a 1.0.5 OTA does not reach 1.0.4 builds. Verify the version and update channel of the actually installed app. A new production AAB may be necessary before its users can receive 1.0.5 updates. The manual Android build workflow prepares an AAB; uploading it to Google Play is a separate owner action.

Configure any required Expo environment variables and Android signing/configuration in Expo before running a workflow. The ignored google-services.json is deliberately not included. Run the preview OTA and confirm startup on a compatible physical-device build before any production or legacy update.
