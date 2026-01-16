/**
 * OpenDRM Embeddable Player Widget
 *
 * Drop-in player that can be added to any page with a single script tag.
 *
 * Usage:
 *   <div id="opendrm-player"
 *        data-manifest="https://cdn.example.com/video/manifest.mpd"
 *        data-token="eyJ..."
 *        data-license-server="https://license.example.com">
 *   </div>
 *   <script src="https://cdn.opendrm.io/embed.js"></script>
 *
 * Or programmatically:
 *   OpenDRMEmbed.create({
 *     container: '#my-player',
 *     manifest: 'https://...',
 *     token: 'eyJ...',
 *     licenseServer: 'https://...'
 *   });
 */

interface EmbedConfig {
  container: string | HTMLElement;
  manifest: string;
  licenseServer: string;
  token?: string;
  autoplay?: boolean;
  muted?: boolean;
  poster?: string;
  width?: string;
  height?: string;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
}

interface EmbedPlayer {
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  destroy: () => void;
  getState: () => {
    currentTime: number;
    duration: number;
    paused: boolean;
    volume: number;
  };
}

declare const shaka: any;

class OpenDRMEmbed {
  private static players: Map<string, EmbedPlayer> = new Map();
  private static shakaLoaded = false;

  /**
   * Create an embedded player
   */
  static async create(config: EmbedConfig): Promise<EmbedPlayer> {
    // Get container
    const container =
      typeof config.container === 'string'
        ? document.querySelector<HTMLElement>(config.container)
        : config.container;

    if (!container) {
      throw new Error(`Container not found: ${config.container}`);
    }

    // Load Shaka Player if needed
    await this.loadShaka();

    // Create player wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'opendrm-player-wrapper';
    wrapper.style.cssText = `
      position: relative;
      width: ${config.width || '100%'};
      height: ${config.height || 'auto'};
      background: #000;
    `;

    // Create video element
    const video = document.createElement('video');
    video.className = 'opendrm-video';
    video.style.cssText = 'width: 100%; height: 100%;';
    video.controls = true;
    video.autoplay = config.autoplay ?? false;
    video.muted = config.muted ?? false;
    if (config.poster) {
      video.poster = config.poster;
    }

    wrapper.appendChild(video);
    container.appendChild(wrapper);

    // Initialize Shaka Player
    await shaka.polyfill.installAll();

    if (!shaka.Player.isBrowserSupported()) {
      throw new Error('Browser not supported');
    }

    const player = new shaka.Player();
    await player.attach(video);

    // Configure DRM
    const drmConfig: any = {
      drm: {
        servers: {
          'org.w3.clearkey': `${config.licenseServer}/api/v1/license/clearkey`,
          'com.widevine.alpha': `${config.licenseServer}/api/v1/license/widevine`,
        },
      },
    };

    player.configure(drmConfig);

    // Add auth header if token provided
    if (config.token) {
      player.getNetworkingEngine().registerRequestFilter(
        (type: number, request: any) => {
          if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
            request.headers['Authorization'] = `Bearer ${config.token}`;
          }
        }
      );
    }

    // Load content
    try {
      await player.load(config.manifest);
      config.onReady?.();
    } catch (error) {
      config.onError?.(error as Error);
      throw error;
    }

    // Set up event handlers
    video.addEventListener('play', () => config.onPlay?.());
    video.addEventListener('pause', () => config.onPause?.());
    video.addEventListener('ended', () => config.onEnded?.());

    player.addEventListener('error', (event: any) => {
      config.onError?.(new Error(event.detail?.message || 'Playback error'));
    });

    // Create player interface
    const embedPlayer: EmbedPlayer = {
      play: () => video.play(),
      pause: () => video.pause(),
      seek: (time: number) => {
        video.currentTime = time;
      },
      setVolume: (volume: number) => {
        video.volume = Math.max(0, Math.min(1, volume));
      },
      destroy: () => {
        player.destroy();
        wrapper.remove();
        this.players.delete(container.id);
      },
      getState: () => ({
        currentTime: video.currentTime,
        duration: video.duration || 0,
        paused: video.paused,
        volume: video.volume,
      }),
    };

    if (container.id) {
      this.players.set(container.id, embedPlayer);
    }

    return embedPlayer;
  }

  /**
   * Get an existing player by container ID
   */
  static get(containerId: string): EmbedPlayer | undefined {
    return this.players.get(containerId);
  }

  /**
   * Load Shaka Player script
   */
  private static async loadShaka(): Promise<void> {
    if (this.shakaLoaded || typeof shaka !== 'undefined') {
      this.shakaLoaded = true;
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/shaka-player@4.7.0/dist/shaka-player.compiled.min.js';
      script.onload = () => {
        this.shakaLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Shaka Player'));
      document.head.appendChild(script);
    });
  }

  /**
   * Auto-initialize players from data attributes
   */
  static autoInit(): void {
    document.querySelectorAll('[data-opendrm-player]').forEach(async (el) => {
      const container = el as HTMLElement;
      const manifest = container.dataset.manifest;
      const licenseServer = container.dataset.licenseServer;
      const token = container.dataset.token;

      if (!manifest || !licenseServer) {
        console.error('OpenDRM: Missing required data attributes (data-manifest, data-license-server)');
        return;
      }

      try {
        await this.create({
          container,
          manifest,
          licenseServer,
          token,
          autoplay: container.dataset.autoplay === 'true',
          muted: container.dataset.muted === 'true',
          poster: container.dataset.poster,
        });
      } catch (error) {
        console.error('OpenDRM: Failed to initialize player', error);
      }
    });
  }
}

// Auto-init on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => OpenDRMEmbed.autoInit());
  } else {
    OpenDRMEmbed.autoInit();
  }
}

// Export for module usage
export { OpenDRMEmbed, EmbedConfig, EmbedPlayer };

// Attach to window for script tag usage
if (typeof window !== 'undefined') {
  (window as any).OpenDRMEmbed = OpenDRMEmbed;
}
