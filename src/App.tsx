import React, { useState, useEffect } from 'react';
import ColorThief from 'colorthief';

interface SongData {
  title: string;
  artist: string;
  album: string;
  state: 'playing' | 'paused';
  timestamp: number;
  albumArt?: string;
  duration?: number;
  position?: number;
}

const App: React.FC = () => {
  const [currentSong, setCurrentSong] = useState<SongData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [lastPosition, setLastPosition] = useState<number>(0);
  const [backgroundColor, setBackgroundColor] = useState<string>('linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
  const [textColor, setTextColor] = useState<string>('white');
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [previousSong, setPreviousSong] = useState<SongData | null>(null);
  const [displaySong, setDisplaySong] = useState<SongData | null>(null);

  // Function to extract colors from album art and set background
  const extractColorsFromAlbumArt = (imageSrc: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const colorThief = new ColorThief();
        const dominantColor = colorThief.getColor(img);
        const palette = colorThief.getPalette(img, 3);
        
        // Convert RGB to hex
        const rgbToHex = (r: number, g: number, b: number) => 
          '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
          }).join('');
        
        // Create gradient from dominant colors
        const color1 = rgbToHex(dominantColor[0], dominantColor[1], dominantColor[2]);
        const color2 = palette.length > 1 ? 
          rgbToHex(palette[1][0], palette[1][1], palette[1][2]) : 
          rgbToHex(Math.max(0, dominantColor[0] - 30), Math.max(0, dominantColor[1] - 30), Math.max(0, dominantColor[2] - 30));
        
        setBackgroundColor(`linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`);
        
        // Determine text color based on brightness
        const brightness = (dominantColor[0] * 299 + dominantColor[1] * 587 + dominantColor[2] * 114) / 1000;
        setTextColor(brightness > 128 ? '#000000' : '#ffffff');
      } catch (error) {
        console.log('Color extraction failed:', error);
        // Fallback to default colors
        setBackgroundColor('linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
        setTextColor('white');
      }
    };
    img.src = imageSrc;
  };

  useEffect(() => {
    // Function to fetch current song from our API
    const fetchCurrentSong = async () => {
      try {
        // Try multiple ports in case the server started on a different port
        const ports = [3001, 3002, 3003, 3004, 3005];
        let response: Response | null = null;
        
        for (const port of ports) {
          try {
            const testResponse = await fetch(`http://localhost:${port}/api/current-song`, {
              signal: AbortSignal.timeout(1000) // 1 second timeout
            });
            if (testResponse.ok) {
              response = testResponse;
              break;
            }
          } catch (e) {
            // Continue to next port
            continue;
          }
        }
        
        if (response && response.ok) {
          const songData = await response.json();
          if (songData) {
            console.log('🎵 Received song data:', {
              title: songData.title,
              artist: songData.artist,
              state: songData.state,
              position: songData.position,
              duration: songData.duration
            });
            setCurrentSong(songData);
            setIsLoading(false);
          } else {
            // No song playing
            console.log('🎵 No song data received');
            setCurrentSong(null);
            setIsLoading(false);
          }
        } else {
          console.error('Failed to fetch song data from any port');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching song data:', error);
        setIsLoading(false);
      }
    };

    // Fetch initial data
    fetchCurrentSong();

    // Set up polling every 2 seconds to get updates
    const interval = setInterval(fetchCurrentSong, 2000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Update progress based on real song data and simulate between updates
  useEffect(() => {
    // Use currentSong for real-time updates, displaySong for display
    const songToUse = currentSong || displaySong;
    if (songToUse?.duration && songToUse?.position) {
      const progressPercent = (songToUse.position / songToUse.duration) * 100;
      setProgress(progressPercent);
      setLastPosition(songToUse.position);
      setLastUpdateTime(Date.now());
    } else {
      setProgress(0);
      setLastPosition(0);
      setLastUpdateTime(0);
    }
  }, [currentSong?.position, currentSong?.duration, displaySong?.position, displaySong?.duration]);

  // Detect song changes and trigger animations
  useEffect(() => {
    if (currentSong && previousSong) {
      const songChanged = 
        currentSong.title !== previousSong.title ||
        currentSong.artist !== previousSong.artist ||
        currentSong.album !== previousSong.album;
      
      if (songChanged) {
        // Start animation with old content still showing
        setIsAnimating(true);
        
        // After animation completes, update display content
        setTimeout(() => {
          setDisplaySong(currentSong);
          setIsAnimating(false);
        }, 500);
      }
    } else if (currentSong && !previousSong) {
      // First song load
      setDisplaySong(currentSong);
    }
    setPreviousSong(currentSong);
  }, [currentSong, previousSong]);

  // Extract colors when album art changes
  useEffect(() => {
    if (currentSong?.albumArt) {
      extractColorsFromAlbumArt(currentSong.albumArt);
    } else {
      // Reset to default colors when no album art
      setBackgroundColor('linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
      setTextColor('white');
    }
  }, [currentSong?.albumArt]);

  // Client-side progress simulation - only when playing
  useEffect(() => {
    // Use currentSong for real-time state, displaySong for display
    const songToUse = currentSong || displaySong;
    console.log('🎵 Progress simulation check:', {
      hasDuration: !!songToUse?.duration,
      hasPosition: !!songToUse?.position,
      state: songToUse?.state,
      willSimulate: songToUse?.state === 'playing',
      lastPosition,
      lastUpdateTime
    });
    
    if (!songToUse?.duration || !songToUse?.position || songToUse.state !== 'playing') {
      console.log('🎵 Not simulating progress - conditions not met');
      return;
    }

    console.log('🎵 Starting progress simulation');
    const simulateProgress = () => {
      const now = Date.now();
      const timeSinceUpdate = (now - lastUpdateTime) / 1000; // seconds
      const simulatedPosition = lastPosition + timeSinceUpdate;
      const progressPercent = (simulatedPosition / (songToUse.duration || 1)) * 100;

      if (progressPercent <= 100) {
        setProgress(progressPercent);
      }
    };

    const interval = setInterval(simulateProgress, 100); // Update every 100ms for smooth animation
    return () => {
      console.log('🎵 Stopping progress simulation');
      clearInterval(interval);
    };
  }, [currentSong?.state, currentSong?.position, currentSong?.duration, lastPosition, lastUpdateTime]);

  // Stop progress simulation when paused
  useEffect(() => {
    // Use currentSong for real-time state checking
    if (currentSong?.state === 'paused') {
      console.log('🎵 Song paused, stopping progress simulation');
      // When paused, keep the current progress but don't simulate further progress
      if (currentSong?.duration && currentSong?.position) {
        const progressPercent = (currentSong.position / currentSong.duration) * 100;
        setProgress(progressPercent);
      }
    } else if (currentSong?.state === 'playing') {
      console.log('🎵 Song playing, progress simulation should start');
    }
  }, [currentSong?.state, currentSong?.position, currentSong?.duration]);

  if (isLoading && !displaySong) {
    return (
      <div 
        className="w-screen h-screen flex justify-center items-center transition-all duration-1000"
        style={{ background: backgroundColor }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 mx-auto mb-4" style={{ borderColor: textColor }}></div>
          <p className="text-xl font-medium" style={{ color: textColor }}>Loading music data...</p>
        </div>
      </div>
    );
  }

  if (!displaySong) {
    return (
      <div 
        className="w-screen h-screen flex justify-center items-center transition-all duration-1000"
        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
      >
        <div className="text-center">
          <div className="text-6xl mb-6">🎵</div>
          <h2 className="text-2xl font-bold mb-4 text-white">No Music Playing</h2>
          <p className="text-lg opacity-80 text-white">Start playing music in Apple Music to see the current track here.</p>
        </div>
      </div>
    );
  }


  return (
    <div 
      className="w-screen h-screen flex justify-center items-center p-4 transition-all duration-1000"
      style={{ background: backgroundColor }}
    >
      <div className="max-w-lg w-full">
        {/* Album Art */}
        <div className="flex items-start gap-6 mb-8">
          <div className="w-40 h-40 rounded-3xl shadow-2xl flex-shrink-0 flex items-center justify-center overflow-hidden relative">
            {displaySong?.albumArt ? (
              <img 
                src={displaySong.albumArt}
                alt={`${displaySong.artist} - ${displaySong.album}`}
                className={`w-full h-full object-cover transition-opacity duration-500 ease-in-out ${
                  isAnimating ? 'opacity-0' : 'opacity-100'
                }`}
                onError={(e) => {
                  // Hide image and show emoji fallback
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ease-in-out ${
                displaySong?.albumArt ? 'opacity-0' : 'opacity-100'
              }`}
              style={{ 
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <div className="text-center">
                <div className="text-4xl mb-2">🎵</div>
                <div className="text-xs opacity-60" style={{ color: textColor }}>
                  No Artwork
                </div>
              </div>
            </div>
          </div>
          
          {/* Song Info */}
          <div className="flex-1 min-w-0">
            <h1 
              className={`text-3xl font-bold leading-tight mb-2 truncate transition-all duration-500 ease-out ${
                isAnimating ? 'transform translate-x-8 opacity-0' : 'transform translate-x-0 opacity-100'
              }`}
              style={{ color: textColor }}
            >
              {displaySong?.title || ''}
            </h1>
            <p 
              className={`text-xl font-medium mb-2 truncate opacity-90 transition-all duration-500 ease-out delay-100 ${
                isAnimating ? 'transform translate-x-8 opacity-0' : 'transform translate-x-0 opacity-90'
              }`}
              style={{ color: textColor }}
            >
              {displaySong?.artist || ''}
            </p>
            <p 
              className={`text-base truncate opacity-70 transition-all duration-500 ease-out delay-200 ${
                isAnimating ? 'transform translate-x-8 opacity-0' : 'transform translate-x-0 opacity-70'
              }`}
              style={{ color: textColor }}
            >
              {displaySong?.album || ''}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div 
            className={`w-full rounded-full h-3 shadow-inner transition-all duration-500 ease-out delay-300 ${
              isAnimating ? 'transform translate-y-4 opacity-0' : 'transform translate-y-0 opacity-100'
            }`}
            style={{ backgroundColor: `${textColor}20` }}
          >
            <div 
              className="h-3 rounded-full transition-all duration-100 ease-linear shadow-lg"
              style={{ 
                width: `${Math.min(progress, 100)}%`,
                backgroundColor: textColor
              }}
            ></div>
          </div>
          {/* Time Display */}
          {displaySong?.duration && (
            <div 
              className={`flex justify-between text-sm mt-3 font-medium transition-all duration-500 ease-out delay-400 ${
                isAnimating ? 'transform translate-y-4 opacity-0' : 'transform translate-y-0 opacity-100'
              }`}
              style={{ color: textColor }}
            >
              <span>{Math.floor((progress * displaySong.duration / 100) / 60)}:{(Math.floor((progress * displaySong.duration / 100) % 60)).toString().padStart(2, '0')}</span>
              <span>{Math.floor(displaySong.duration / 60)}:{(Math.floor(displaySong.duration % 60)).toString().padStart(2, '0')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
