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
// Google Play build (anything but RSD_DISTRIBUTION=direct): no Razorpay at all.
// The Razorpay checkout and plans screen are swapped for empty stand-ins and the
// Razorpay package resolves to nothing, so none of it is bundled. The native SDK
// is left out separately (react-native.config.js).
if (process.env.RSD_DISTRIBUTION !== 'direct') {
  const path = require('path');
  const key = file => path.resolve(file).toLowerCase();
  const swaps = new Map([
    [key(path.join(__dirname, 'services', 'razorpay.ts')), path.join(__dirname, 'stubs', 'razorpay.store.ts')],
    [key(path.join(__dirname, 'components', 'razorpay-plans.tsx')), path.join(__dirname, 'stubs', 'razorpay-plans.store.tsx')],
  ]);
  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'react-native-razorpay') return { type: 'empty' };
    const result = (upstream ?? context.resolveRequest)(context, moduleName, platform);
    const swap = result.type === 'sourceFile' ? swaps.get(key(result.filePath)) : undefined;
    return swap ? { type: 'sourceFile', filePath: swap } : result;
  };
}
module.exports = config;
