/**
 * OpenDRM React Integration Example
 *
 * Install: npm install @opendrm/player-sdk shaka-player
 */

import React, { useEffect, useRef, useState } from 'react';
import { OpenDRMPlayer, PlaybackState } from '@opendrm/player-sdk';

interface VideoPlayerProps {
  manifestUrl: string;
  licenseServer: string;
  token: string;
  autoplay?: boolean;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

/**
 * React component for OpenDRM player
 */
export function VideoPlayer({
  manifestUrl,
  licenseServer,
  token,
  autoplay = false,
  onReady,
  onError,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<OpenDRMPlayer | null>(null);
  const [state, setState] = useState<PlaybackState | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const player = new OpenDRMPlayer({
      container: containerRef.current,
      licenseServer,
      token,
      playerType: 'shaka',
    });

    playerRef.current = player;

    async function init() {
      try {
        await player.initialize();
        await player.load({ manifestUrl, token });
        setIsReady(true);
        onReady?.();

        if (autoplay) {
          await player.play();
        }

        // Set up state updates
        player.on('timeupdate', () => {
          setState(player.getState());
        });
      } catch (error) {
        onError?.(error as Error);
      }
    }

    init();

    return () => {
      player.destroy();
    };
  }, [manifestUrl, licenseServer, token]);

  const handlePlay = async () => {
    await playerRef.current?.play();
  };

  const handlePause = () => {
    playerRef.current?.pause();
  };

  const handleSeek = (time: number) => {
    playerRef.current?.seek(time);
  };

  return (
    <div className="opendrm-react-player">
      <div
        ref={containerRef}
        style={{
          width: '100%',
          aspectRatio: '16/9',
          background: '#000',
        }}
      />

      {/* Optional: Custom controls */}
      {isReady && state && (
        <div className="player-controls" style={{ padding: '10px' }}>
          <button onClick={state.paused ? handlePlay : handlePause}>
            {state.paused ? 'Play' : 'Pause'}
          </button>
          <input
            type="range"
            min={0}
            max={state.duration}
            value={state.currentTime}
            onChange={(e) => handleSeek(Number(e.target.value))}
            style={{ marginLeft: '10px', flex: 1 }}
          />
          <span style={{ marginLeft: '10px' }}>
            {formatTime(state.currentTime)} / {formatTime(state.duration)}
          </span>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * React hook for OpenDRM
 */
export function useOpenDRM(licenseServer: string, apiKey: string) {
  const [client] = useState(() => {
    // This would use the SDK's license client
    return {
      async generateToken(subject: string, contentId?: string) {
        const response = await fetch(`${licenseServer}/api/v1/auth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          body: JSON.stringify({ subject, contentId }),
        });
        return response.json();
      },

      async createKey() {
        const response = await fetch(`${licenseServer}/api/v1/keys`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
        });
        return response.json();
      },
    };
  });

  return client;
}

/**
 * Example usage in a React app
 */
export function App() {
  const [token, setToken] = useState<string>('');
  const drm = useOpenDRM('http://localhost:3000', 'sk_live_xxx');

  useEffect(() => {
    // Generate a token on mount
    drm.generateToken('user-123', 'video-001').then((data) => {
      setToken(data.token);
    });
  }, []);

  if (!token) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1>OpenDRM React Example</h1>

      <VideoPlayer
        manifestUrl="https://cdn.example.com/video/manifest.mpd"
        licenseServer="http://localhost:3000"
        token={token}
        onReady={() => console.log('Player ready!')}
        onError={(err) => console.error('Player error:', err)}
      />
    </div>
  );
}

export default App;
