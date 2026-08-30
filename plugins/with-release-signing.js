/**
 * Expo-Config-Plugin: trägt die Release-Signierung in android/app/build.gradle ein.
 *
 * Der Ordner android/ wird von `expo prebuild` neu erzeugt und ist gitignored —
 * manuelle Änderungen dort wären beim nächsten Prebuild weg. Deshalb läuft die
 * Signierung über dieses Plugin.
 *
 * Die Zugangsdaten stehen NICHT im Repo, sondern in ~/.gradle/gradle.properties:
 *   REVIEWER_UPLOAD_STORE_FILE, REVIEWER_UPLOAD_KEY_ALIAS,
 *   REVIEWER_UPLOAD_STORE_PASSWORD, REVIEWER_UPLOAD_KEY_PASSWORD
 * Fehlen sie, fällt der Build auf den Debug-Key zurück und bleibt lauffähig.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const SIGNING_CONFIG = `
        release {
            if (project.hasProperty('REVIEWER_UPLOAD_STORE_FILE')) {
                storeFile file(REVIEWER_UPLOAD_STORE_FILE)
                storePassword REVIEWER_UPLOAD_STORE_PASSWORD
                keyAlias REVIEWER_UPLOAD_KEY_ALIAS
                keyPassword REVIEWER_UPLOAD_KEY_PASSWORD
            }
        }
`;

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    if (contents.includes('REVIEWER_UPLOAD_STORE_FILE')) {
      return cfg;
    }

    // signingConfigs { debug { ... } } um einen release-Block ergänzen
    const debugBlockEnd = contents.indexOf('signingConfigs {');
    if (debugBlockEnd === -1) {
      throw new Error('signingConfigs-Block in build.gradle nicht gefunden');
    }
    const insertAt = contents.indexOf('}', contents.indexOf('debug {', debugBlockEnd)) + 1;
    contents = contents.slice(0, insertAt) + '\n' + SIGNING_CONFIG + contents.slice(insertAt);

    // Release-Buildtype auf den release-Key umstellen
    contents = contents.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      "$1signingConfig project.hasProperty('REVIEWER_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug"
    );

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = withReleaseSigning;
