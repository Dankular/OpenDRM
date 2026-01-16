/**
 * Video.js adapter for OpenDRM
 *
 * Requires video.js and videojs-contrib-eme plugin
 */

import type { PlayerAdapter, DRMConfig, PlaybackState, PlayerEvents } from './types.js';

// Video.js types (simplified)
declare const videojs: any;

export class VideoJSAdapter implements PlayerAdapter {
  private player: any = null;
  private containerEl: HTMLElement | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();

  async initialize(container: HTMLElement | string): Promise<void> {
    // Get or create container element
    this.containerEl =
      typeof container === 'string'
        ? document.querySelector<HTMLElement>(container)
        : container;

    if (!this.containerEl) {
      throw new Error('Container element not found');
    }

    // Create video element with Video.js data attributes
    const videoEl = document.createElement('video');
    videoEl.className = 'video-js vjs-default-skin';
    videoEl.style.width = '100%';
    videoEl.style.height = '100%';
    this.containerEl.appendChild(videoEl);

    // Initialize Video.js
    this.player = videojs(videoEl, {
      controls: true,
      autoplay: false,
      preload: 'auto',
      html5: {
        vhs: {
          overrideNative: true,
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
    });

    // Wait for player to be ready
    await new Promise<void>((resolve) => {
      this.player.ready(() => resolve());
    });

    // Set up event handlers
    this.setupEventHandlers();
  }

  async load(manifestUrl: string, drmConfig?: DRMConfig): Promise<void> {
    if (!this.player) {
      throw new Error('Player not initialized');
    }

    // Determine source type
    const type = this.getSourceType(manifestUrl);

    // Build source configuration
    const sourceConfig: any = {
      src: manifestUrl,
      type,
    };

    // Add DRM configuration if provided
    if (drmConfig) {
      sourceConfig.keySystems = this.buildKeySystemsConfig(drmConfig);
    }

    // Load source
    this.player.src(sourceConfig);

    // Wait for metadata
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        this.player.off('loadedmetadata', onLoaded);
        this.player.off('error', onError);
        resolve();
      };

      const onError = () => {
        this.player.off('loadedmetadata', onLoaded);
        this.player.off('error', onError);
        reject(new Error('Failed to load content'));
      };

      this.player.on('loadedmetadata', onLoaded);
      this.player.on('error', onError);
    });

    this.emit('loaded');
  }

  private getSourceType(url: string): string {
    if (url.includes('.mpd')) {
      return 'application/dash+xml';
    } else if (url.includes('.m3u8')) {
      return 'application/x-mpegURL';
    }
    return 'video/mp4';
  }

  private buildKeySystemsConfig(config: DRMConfig): Record<string, any> {
    const keySystems: Record<string, any> = {};
    const headers = {
      ...config.headers,
      ...(config.token && { Authorization: `Bearer ${config.token}` }),
    };

    // ClearKey
    if (config.clearKeyUrl) {
      keySystems['org.w3.clearkey'] = {
        getLicense: async (emeOptions: any, keyMessage: ArrayBuffer) => {
          const response = await fetch(config.clearKeyUrl!, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: new TextDecoder().decode(keyMessage),
          });

          if (!response.ok) {
            throw new Error(`License request failed: ${response.status}`);
          }

          return response.arrayBuffer();
        },
      };
    }

    // Widevine
    if (config.widevineUrl) {
      keySystems['com.widevine.alpha'] = {
        url: config.widevineUrl,
        licenseHeaders: headers,
      };
    }

    // FairPlay
    if (config.fairPlayUrl) {
      keySystems['com.apple.fps.1_0'] = {
        certificateUri: config.fairPlayCertificateUrl,
        licenseUri: config.fairPlayUrl,
        licenseHeaders: headers,
      };
    }

    return keySystems;
  }

  async play(): Promise<void> {
    if (this.player) {
      await this.player.play();
    }
  }

  pause(): void {
    if (this.player) {
      this.player.pause();
    }
  }

  seek(time: number): void {
    if (this.player) {
      this.player.currentTime(time);
    }
  }

  getState(): PlaybackState {
    if (!this.player) {
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

    const buffered = this.player.buffered();
    const bufferedEnd =
      buffered.length > 0 ? buffered.end(buffered.length - 1) : 0;

    return {
      currentTime: this.player.currentTime() || 0,
      duration: this.player.duration() || 0,
      paused: this.player.paused(),
      buffering: this.player.readyState() < 3,
      buffered: bufferedEnd,
      playbackRate: this.player.playbackRate(),
      volume: this.player.volume(),
      muted: this.player.muted(),
      encrypted: !!this.player.eme?.activeSessions?.length,
      quality: this.getCurrentQuality(),
    };
  }

  private getCurrentQuality(): PlaybackState['quality'] | undefined {
    try {
      const tech = this.player.tech({ IWillNotUseThisInPlugins: true });
      if (tech && tech.vhs) {
        const media = tech.vhs.playlists.media();
        if (media && media.attributes) {
          return {
            width: media.attributes.RESOLUTION?.width || 0,
            height: media.attributes.RESOLUTION?.height || 0,
            bitrate: media.attributes.BANDWIDTH || 0,
          };
        }
      }
    } catch {
      // Quality info not available
    }
    return undefined;
  }

  setVolume(volume: number): void {
    if (this.player) {
      this.player.volume(Math.max(0, Math.min(1, volume)));
    }
  }

  setMuted(muted: boolean): void {
    if (this.player) {
      this.player.muted(muted);
    }
  }

  setPlaybackRate(rate: number): void {
    if (this.player) {
      this.player.playbackRate(rate);
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
    if (!this.player) return;

    this.player.on('play', () => this.emit('play'));
    this.player.on('pause', () => this.emit('pause'));
    this.player.on('ended', () => this.emit('ended'));
    this.player.on('timeupdate', () =>
      this.emit('timeupdate', this.player.currentTime())
    );

    this.player.on('error', () => {
      const error = this.player.error();
      this.emit('error', new Error(error?.message || 'Playback error'));
    });

    this.player.on('waiting', () => this.emit('buffering', true));
    this.player.on('playing', () => this.emit('buffering', false));
  }

  destroy(): void {
    if (this.player) {
      this.player.dispose();
      this.player = null;
    }

    this.eventListeners.clear();
  }
}
