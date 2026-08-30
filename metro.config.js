const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite auf Web: wa-sqlite.wasm als Asset auflösbar machen
config.resolver.assetExts.push('wasm');

module.exports = config;
