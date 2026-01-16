/**
 * Shaka Player adapter for OpenDRM
 */

import type { PlayerAdapter, DRMConfig, PlaybackState, PlayerEvents } from './types.js';

// Shaka Player types (simplified)
declare const shaka: any;

export class ShakaAdapter implements PlayerAdapter {
  private player: any = null;
  private videoElement: HTMLVideoElement | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();

  async initialize(container: HTMLElement | string): Promise<void> {
    // Get or create container element
    const containerEl =
      typeof container === 'string'
        ? document.querySelector<HTMLElement>(container)
        : container;

    if (!containerEl) {
      throw new Error('Container element not found');
    }

    // Install polyfills
    await shaka.polyfill.installAll();

    // Check browser support
    if (!shaka.Player.isBrowserSupported()) {
      throw new Error('Browser not supported by Shaka Player');
    }

    // Create video element
    this.videoElement = document.createElement('video');
    this.videoElement.style.width = '100%';
    this.videoElement.style.height = '100%';
    this.videoElement.controls = true;
    containerEl.appendChild(this.videoElement);

    // Create player
    this.player = new shaka.Player();
    await this.player.attach(this.videoElement);

    // Set up event handlers
    this.setupEventHandlers();
  }

  async load(manifestUrl: string, drmConfig?: DRMConfig): Promise<void> {
    if (!this.player) {
      throw new Error('Player not initialized');
    }

    // Configure DRM
    if (drmConfig) {
      this.configureDRM(drmConfig);
    }

    // Load content
    await this.player.load(manifestUrl);

    this.emit('loaded');
  }

  private configureDRM(config: DRMConfig): void {
    const drmServers: Record<string, string> = {};
    const advanced: Record<string, any> = {};

    // ClearKey
    if (config.clearKeyUrl) {
      drmServers['org.w3.clearkey'] = config.clearKeyUrl;
    }

    // Widevine
    if (config.widevineUrl) {
      drmServers['com.widevine.alpha'] = config.widevineUrl;

      if (config.token || config.headers) {
        advanced['com.widevine.alpha'] = {
          headers: {
            ...config.headers,
            ...(config.token && { Authorization: `Bearer ${config.token}` }),
          },
        };
      }
    }

    // FairPlay
    if (config.fairPlayUrl) {
      drmServers['com.apple.fps.1_0'] = config.fairPlayUrl;

      advanced['com.apple.fps.1_0'] = {
        serverCertificateUri: config.fairPlayCertificateUrl,
        headers: {
          ...config.headers,
          ...(config.token && { Authorization: `Bearer ${config.token}` }),
        },
      };
    }

    // Apply configuration
    this.player.configure({
      drm: {
        servers: drmServers,
        advanced,
      },
    });

    // Set up license request filter for token injection
    if (config.token || config.headers) {
      this.player.getNetworkingEngine().registerRequestFilter(
        (type: number, request: any) => {
          if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
            Object.assign(request.headers, {
              ...config.headers,
              ...(config.token && { Authorization: `Bearer ${config.token}` }),
            });
          }
        }
      );
    }
  }

  async play(): Promise<void> {
    if (this.videoElement) {
      await this.videoElement.play();
    }
  }

  pause(): void {
    if (this.videoElement) {
      this.videoElement.pause();
    }
  }

  seek(time: number): void {
    if (this.videoElement) {
      this.videoElement.currentTime = time;
    }
  }

  getState(): PlaybackState {
    if (!this.videoElement) {
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

    const buffered = this.videoElement.buffered;
    const bufferedEnd =
      buffered.length > 0 ? buffered.end(buffered.length - 1) : 0;

    // Get current variant for quality info
    const variant = this.player?.getVariantTracks()?.find((t: any) => t.active);

    return {
      currentTime: this.videoElement.currentTime,
      duration: this.videoElement.duration || 0,
      paused: this.videoElement.paused,
      buffering: this.player?.isBuffering() || false,
      buffered: bufferedEnd,
      playbackRate: this.videoElement.playbackRate,
      volume: this.videoElement.volume,
      muted: this.videoElement.muted,
      encrypted: this.player?.drmInfo() !== null,
      quality: variant
        ? {
            width: variant.width,
            height: variant.height,
            bitrate: variant.bandwidth,
          }
        : undefined,
    };
  }

  setVolume(volume: number): void {
    if (this.videoElement) {
      this.videoElement.volume = Math.max(0, Math.min(1, volume));
    }
  }

  setMuted(muted: boolean): void {
    if (this.videoElement) {
      this.videoElement.muted = muted;
    }
  }

  setPlaybackRate(rate: number): void {
    if (this.videoElement) {
      this.videoElement.playbackRate = rate;
    }
  }

  on<K extends keyof PlayerEvents>(event: K, callback: PlayerEvents[K]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off<K extends keyof PlayerEvents>(event: K, callback: PlayerEvents[K]): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  private emit(event: string, ...args: any[]): void {
    this.eventListeners.get(event)?.forEach((callback) => {
      try {
        (callback as Function)(...args);
      } catch (e) {
        console.error(`Error in event handler for ${event}:`, e);
      }
    });
  }

  private setupEventHandlers(): void {
    if (!this.videoElement || !this.player) return;

    this.videoElement.addEventListener('play', () => this.emit('play'));
    this.videoElement.addEventListener('pause', () => this.emit('pause'));
    this.videoElement.addEventListener('ended', () => this.emit('ended'));
    this.videoElement.addEventListener('timeupdate', () =>
      this.emit('timeupdate', this.videoElement!.currentTime)
    );

    this.player.addEventListener('error', (event: any) => {
      const error = event.detail;
      this.emit('error', new Error(error.message || 'Playback error'));
    });

    this.player.addEventListener('buffering', (event: any) => {
      this.emit('buffering', event.buffering);
    });

    this.player.addEventListener('drmsessionupdate', () => {
      const drmInfo = this.player.drmInfo();
      if (drmInfo) {
        this.emit('licenseAcquired', drmInfo.keySystem);
      }
    });

    this.player.addEventListener('adaptation', () => {
      const variant = this.player.getVariantTracks().find((t: any) => t.active);
      if (variant) {
        this.emit('qualityChange', {
          width: variant.width,
          height: variant.height,
          bitrate: variant.bandwidth,
        });
      }
    });
  }

  destroy(): void {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }

    if (this.videoElement) {
      this.videoElement.remove();
      this.videoElement = null;
    }

    this.eventListeners.clear();
  }
}
