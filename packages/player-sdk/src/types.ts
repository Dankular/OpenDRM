/**
 * DRM configuration for content playback
 */
export interface DRMConfig {
  /** ClearKey license server URL */
  clearKeyUrl?: string;

  /** Widevine license server URL */
  widevineUrl?: string;

  /** FairPlay license server URL */
  fairPlayUrl?: string;

  /** FairPlay certificate URL */
  fairPlayCertificateUrl?: string;

  /** Authorization token to include in license requests */
  token?: string;

  /** Additional headers for license requests */
  headers?: Record<string, string>;
}

/**
 * Current playback state
 */
export interface PlaybackState {
  /** Current playback position in seconds */
  currentTime: number;

  /** Total duration in seconds */
  duration: number;

  /** Whether the player is currently paused */
  paused: boolean;

  /** Whether the player is buffering */
  buffering: boolean;

  /** Current buffer end time in seconds */
  buffered: number;

  /** Current playback rate */
  playbackRate: number;

  /** Current volume (0-1) */
  volume: number;

  /** Whether audio is muted */
  muted: boolean;

  /** Whether content is encrypted */
  encrypted: boolean;

  /** Current video quality info */
  quality?: {
    width: number;
    height: number;
    bitrate: number;
  };
}

/**
 * Player event types
 */
export interface PlayerEvents {
  /** Fired when playback starts */
  play: () => void;

  /** Fired when playback is paused */
  pause: () => void;

  /** Fired when playback ends */
  ended: () => void;

  /** Fired when an error occurs */
  error: (error: Error) => void;

  /** Fired when buffering state changes */
  buffering: (isBuffering: boolean) => void;

  /** Fired periodically during playback */
  timeupdate: (currentTime: number) => void;

  /** Fired when content is loaded */
  loaded: () => void;

  /** Fired when a license is acquired */
  licenseAcquired: (drmType: string) => void;

  /** Fired when quality changes */
  qualityChange: (quality: PlaybackState['quality']) => void;
}

/**
 * Common interface for player adapters
 */
export interface PlayerAdapter {
  /** Initialize the player */
  initialize(container: HTMLElement | string): Promise<void>;

  /** Load content */
  load(manifestUrl: string, drmConfig?: DRMConfig): Promise<void>;

  /** Start playback */
  play(): Promise<void>;

  /** Pause playback */
  pause(): void;

  /** Seek to a specific time */
  seek(time: number): void;

  /** Get current playback state */
  getState(): PlaybackState;

  /** Set volume (0-1) */
  setVolume(volume: number): void;

  /** Set muted state */
  setMuted(muted: boolean): void;

  /** Set playback rate */
  setPlaybackRate(rate: number): void;

  /** Register event listener */
  on<K extends keyof PlayerEvents>(event: K, callback: PlayerEvents[K]): void;

  /** Remove event listener */
  off<K extends keyof PlayerEvents>(event: K, callback: PlayerEvents[K]): void;

  /** Destroy the player and clean up resources */
  destroy(): void;
}
