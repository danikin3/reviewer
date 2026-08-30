/**
 * Expo-Config-Plugin: beschraenkt die APK auf die Architekturen echter Geraete.
 *
 * Standardmaessig baut React Native fuer vier Architekturen. Zwei davon,
 * x86 und x86_64, gibt es nur in Emulatoren — kein Android-Telefon nutzt sie.
 * Sie wegzulassen halbiert die Bauzeit und die Groesse der APK, ohne dass
 * ein Geraet dadurch leer ausgeht.
 *
 * Wer die App doch im Emulator starten will, baut einmalig mit:
 *   ./gradlew assembleRelease -PreactNativeArchitectures=x86_64
 */
const { withGradleProperties } = require('expo/config-plugins');

const ARCHITECTURES = 'armeabi-v7a,arm64-v8a';

function withAndroidAbis(config) {
  return withGradleProperties(config, (cfg) => {
    const key = 'reactNativeArchitectures';
    const existing = cfg.modResults.find(
      (item) => item.type === 'property' && item.key === key
    );

    if (existing) {
      existing.value = ARCHITECTURES;
    } else {
      cfg.modResults.push({ type: 'property', key, value: ARCHITECTURES });
    }

    return cfg;
  });
}

module.exports = withAndroidAbis;
