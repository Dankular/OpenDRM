/**
 * OpenDRM Player - Unified player interface
 */

import type { PlayerAdapter, DRMConfig, PlaybackState, PlayerEvents } from './types.js';
import { LicenseClient } from './license-client.js';
import { ShakaAdapter } from './shaka-adapter.js';
import { VideoJSAdapter } from './videojs-adapter.js';

export interface OpenDRMPlayerConfig {
  /** Container element or selector */
  container: HTMLElement | string;

  /** License server URL */
  licenseServer: string;

  /** Player type: 'shaka' or 'videojs' (default: auto-detect) */
  playerType?: 'shaka' | 'videojs' | 'auto';

  /** Authorization token for license requests */
  token?: string;

  /** Additional headers for license requests */
  headers?: Record<string, string>;

  /** Automatically detect and configure DRM based on content */
  autoConfigureDRM?: boolean;
}

export interface LoadOptions {
  /** Manifest URL (MPD or HLS) */
  manifestUrl: string;

  /** Playback token (overrides config token) */
  token?: string;

  /** Explicit key IDs for ClearKey */
  keyIds?: string[];

  /** Additional DRM configuration */
  drm?: Partial<DRMConfig>;
}

export class OpenDRMPlayer {
  private config: OpenDRMPlayerConfig;
  private adapter: PlayerAdapter | null = null;
  private licenseClient: LicenseClient;
  private initialized = false;

  constructor(config: OpenDRMPlayerConfig) {
    this.config = {
      autoConfigureDRM: true,
      playerType: 'auto',
      ...config,
    };

    this.licenseClient = new LicenseClient({
      serverUrl: config.licenseServer,
      token: config.token,
      headers: config.headers,
    });
  }

  /**
   * Initialize the player
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create appropriate adapter
    this.adapter = this.createAdapter();

    // Initialize the adapter
    await this.adapter.initialize(this.config.container);

    this.initialized = true;
  }

  /**
   * Load and play content
   */
  async load(options: LoadOptions): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Update token if provided
    if (options.token) {
      this.licenseClient.setToken(options.token);
    }

    // Build DRM configuration
    const drmConfig = await this.buildDRMConfig(options);

    // Load content
    await this.adapter!.load(options.manifestUrl, drmConfig);
  }

  /**
   * Start playback
   */
  async play(): Promise<void> {
    this.ensureInitialized();
    await this.adapter!.play();
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.ensureInitialized();
    this.adapter!.pause();
  }

  /**
   * Seek to a specific time
   */
  seek(time: number): void {
    this.ensureInitialized();
    this.adapter!.seek(time);
  }

  /**
   * Get current playback state
   */
  getState(): PlaybackState {
    if (!this.adapter) {
      return {
        currentTime: 0,
        duration: 0,
        paused: true,
        buffering: false,
        buffered: 0,
        playbackRate: 1,
        volume: 1,
        muted: false,
        encrypted: false,
      };
    }
    return this.adapter.getState();
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    this.ensureInitialized();
    this.adapter!.setVolume(volume);
  }

  /**
   * Set muted state
   */
  setMuted(muted: boolean): void {
    this.ensureInitialized();
    this.adapter!.setMuted(muted);
  }

  /**
   * Set playback rate
   */
  setPlaybackRate(rate: number): void {
    this.ensureInitialized();
    this.adapter!.setPlaybackRate(rate);
  }

  /**
   * Register event listener
   */
  on<K extends keyof PlayerEvents>(event: K, callback: PlayerEvents[K]): void {
    this.ensureInitialized();
    this.adapter!.on(event, callback);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof PlayerEvents>(event: K, callback: PlayerEvents[K]): void {
    if (this.adapter) {
      this.adapter.off(event, callback);
    }
  }

  /**
   * Destroy the player and clean up resources
   */
  destroy(): void {
    if (this.adapter) {
      this.adapter.destroy();
      this.adapter = null;
    }
    this.initialized = false;
  }

  /**
   * Get the license client for direct API access
   */
  getLicenseClient(): LicenseClient {
    return this.licenseClient;
  }

  private createAdapter(): PlayerAdapter {
    const type = this.detectPlayerType();

    switch (type) {
      case 'shaka':
        return new ShakaAdapter();
      case 'videojs':
        return new VideoJSAdapter();
      default:
        throw new Error(`Unknown player type: ${type}`);
    }
  }

  private detectPlayerType(): 'shaka' | 'videojs' {
    if (this.config.playerType && this.config.playerType !== 'auto') {
      return this.config.playerType;
    }

    // Auto-detect based on available libraries
    if (typeof (window as any).shaka !== 'undefined') {
      return 'shaka';
    }

    if (typeof (window as any).videojs !== 'undefined') {
      return 'videojs';
    }

    // Default to Shaka Player
    return 'shaka';
  }

  private async buildDRMConfig(options: LoadOptions): Promise<DRMConfig> {
    const config: DRMConfig = {
      ...options.drm,
    };

    if (!this.config.autoConfigureDRM) {
      return config;
    }

    // Get token from options or config
    const token = options.token || this.config.token;
    if (token) {
      config.token = token;
    }

    // Get server capabilities to determine what's available
    try {
      const capabilities = await this.licenseClient.getCapabilities();

      // Always set ClearKey if available
      if (capabilities.clearkey) {
        config.clearKeyUrl = this.licenseClient.getClearKeyUrl();
      }

      // Set Widevine if available
      if (capabilities.widevine) {
        config.widevineUrl = this.licenseClient.getWidevineUrl();
      }

      // Set FairPlay if available and we're on Safari
      if (capabilities.fairplay && this.isSafari()) {
        config.fairPlayUrl = this.licenseClient.getFairPlayUrl();
        config.fairPlayCertificateUrl = this.licenseClient.getFairPlayCertificateUrl();
      }
    } catch (error) {
      console.warn('Failed to get DRM capabilities, using ClearKey only:', error);
      config.clearKeyUrl = this.licenseClient.getClearKeyUrl();
    }

    // Merge any additional headers
    config.headers = {
      ...this.config.headers,
      ...this.licenseClient.getHeaders(),
    };

    return config;
  }

  private isSafari(): boolean {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }

  private ensureInitialized(): void {
    if (!this.adapter) {
      throw new Error('Player not initialized. Call initialize() first.');
    }
  }
}
