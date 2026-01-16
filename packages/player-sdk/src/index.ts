/**
 * OpenDRM Player SDK
 *
 * Unified interface for playing DRM-protected content with
 * Shaka Player or Video.js backends.
 */

export { OpenDRMPlayer, type OpenDRMPlayerConfig, type LoadOptions } from './player.js';
export { LicenseClient, type LicenseConfig } from './license-client.js';
export { ShakaAdapter } from './shaka-adapter.js';
export { VideoJSAdapter } from './videojs-adapter.js';
export type { PlayerAdapter, DRMConfig, PlaybackState, PlayerEvents } from './types.js';
