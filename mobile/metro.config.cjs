/* global __dirname */
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Keep React/React Native isolated from the parent Next.js install.
config.resolver.nodeModulesPaths = [require('path').resolve(__dirname, 'node_modules')];
// Allow nested dependencies inside mobile, while excluding the website's copies.
const websiteModules = require('path').resolve(__dirname, '..', 'node_modules');
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const existing = config.resolver.blockList ?? [];
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : [existing]),
  new RegExp(escape(websiteModules) + '[/\\\\].*'),
  new RegExp(escape(__dirname) + '[/\\\\](android|ios)[/\\\\].*'),
  // Native compilation outputs can contain thousands of changing files.
  /[/\\]node_modules[/\\].*[/\\]android[/\\](build|\.cxx)[/\\].*/,
];
module.exports = config;
