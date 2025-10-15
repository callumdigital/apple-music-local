import { DeskThing } from '@deskthing/server';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseFile } from 'music-metadata';

interface SongData {
  title: string;
  artist: string;
  album: string;
  state: 'playing' | 'paused';
  albumArt?: string;
  duration?: number;
  position?: number;
  timestamp?: number;
}

interface LastSongData extends SongData {
  timestamp: number;
}

interface iTunesResult {
  artistName: string;
  collectionName: string;
  artworkUrl100?: string;
}

interface iTunesResponse {
  results: iTunesResult[];
  resultCount: number;
}

interface LastFmImage {
  size: string;
  '#text': string;
}

interface LastFmAlbum {
  name: string;
  artist: string;
  image: LastFmImage[];
}

interface LastFmResponse {
  album: LastFmAlbum;
}

class AppleMusicNowPlaying {
  private positionIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastSongData: LastSongData | null = null;
  private currentSong: SongData | null = null;
  private lastSongKey: string = '';

  private log(message: string): void {
    if (typeof DeskThing.sendLog === 'function') {
      DeskThing.sendLog(message);
    } else {
      console.log(message);
    }
  }

  constructor() {
    this.log('Custom Now Playing app started');
  }

  public start(): void {
    // Send initial song data
    this.sendCurrentSong();

    // Check for changes every 2 seconds (less frequent)
    this.positionIntervalId = setInterval(() => {
      this.checkForChanges();
    }, 2000);
  }

  public stop(): void {
    if (this.positionIntervalId) {
      clearInterval(this.positionIntervalId);
      this.positionIntervalId = null;
    }
    this.log('Custom Now Playing app stopped');
  }

  private async checkForChanges(): Promise<void> {
    try {
      const basicSong = this.getBasicSongInfo();
      if (!basicSong) return;

      const currentSongKey = `${basicSong.artist}-${basicSong.title}-${basicSong.album}`;
      const hasSongChanged = currentSongKey !== this.lastSongKey;
      const hasPositionChanged = this.currentSong ?
        Math.abs((this.currentSong.position || 0) - (basicSong.position || 0)) > 1 : true;
      const hasStateChanged = this.currentSong?.state !== basicSong.state;
      
      // Log state changes for debugging
      if (hasStateChanged && this.currentSong) {
        this.log(`🔄 State changed: ${this.currentSong.state} → ${basicSong.state}`);
      }

      // If song changed, fetch album art and reset everything
      if (hasSongChanged) {
        this.log('🎵 Song changed, fetching album art...');
        this.lastSongKey = currentSongKey;

        const albumArt = await this.getAlbumArt();
        const fullSong = { ...basicSong, albumArt: albumArt || undefined };

        this.currentSong = fullSong;
        this.sendSongToDeskThing(fullSong);
        this.lastSongData = {
          ...fullSong,
          timestamp: Date.now()
        };
        return;
      }

      // If position changed significantly or state changed, update
      if (hasPositionChanged || hasStateChanged) {
        if (this.currentSong) {
          this.currentSong.position = basicSong.position;
          this.currentSong.duration = basicSong.duration;
          this.currentSong.state = basicSong.state;
          // Send updated song data when state changes (especially when pausing)
          this.sendSongToDeskThing(this.currentSong);
        } else {
          this.currentSong = basicSong;
        }
      }
    } catch (error) {
      this.log('Error checking changes: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private async sendCurrentSong(): Promise<void> {
    try {
      const currentSong = await this.getCurrentSong();
      this.currentSong = currentSong; // Store current song for API access
      if (currentSong) {
        this.sendSongToDeskThing(currentSong);
        this.lastSongData = {
          ...currentSong,
          timestamp: Date.now()
        };
        // Set the lastSongKey to prevent unnecessary album art fetching
        this.lastSongKey = `${currentSong.artist}-${currentSong.title}-${currentSong.album}`;
      }
    } catch (error) {
      this.log('Error sending current song: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  public getCurrentSongData(): SongData | null {
    return this.currentSong;
  }

  private getBasicSongInfo(): SongData | null {
    try {
      // Check if Apple Music is running and get player state
      const playerState = this.getPlayerState();
      if (playerState === 'stopped') {
        return null;
      }

      // Get track information (fast operations)
      const title = this.getTrackTitle();
      const artist = this.getTrackArtist();
      const album = this.getTrackAlbum();
      const duration = this.getSongDuration();
      const position = this.getSongPosition();

      // If we can't get basic info, assume nothing is playing
      if (!title || !artist) {
        return null;
      }

      return {
        title,
        artist,
        album: album || 'Unknown Album',
        state: playerState as 'playing' | 'paused',
        duration: duration > 0 ? duration : undefined,
        position: position > 0 ? position : undefined
      };
    } catch (error) {
      // Apple Music not open or other error
      return null;
    }
  }

  private async getCurrentSong(): Promise<SongData | null> {
    try {
      const basicSong = this.getBasicSongInfo();
      if (!basicSong) return null;

      const albumArt = await this.getAlbumArt();
      return {
        ...basicSong,
        albumArt: albumArt || undefined
      };
    } catch (error) {
      // Apple Music not open or other error
      return null;
    }
  }

  private getPlayerState(): string {
    try {
      const script = `
        tell application "Music"
          if it is running then
            try
              return player state as string
            on error
              return "stopped"
            end try
          else
            return "stopped"
          end if
        end tell
      `;
      return execSync(`osascript -e '${script}'`, { encoding: 'utf8' }).trim();
    } catch {
      return 'stopped';
    }
  }

  private getTrackTitle(): string {
    try {
      const script = `
        tell application "Music"
          if it is running then
            try
              return name of current track
            on error
              return ""
            end try
          else
            return ""
          end if
        end tell
      `;
      return execSync(`osascript -e '${script}'`, { encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  }

  private getTrackArtist(): string {
    try {
      const script = `
        tell application "Music"
          if it is running then
            try
              return artist of current track
            on error
              return ""
            end try
          else
            return ""
          end if
        end tell
      `;
      return execSync(`osascript -e '${script}'`, { encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  }

  private getTrackAlbum(): string {
    try {
      const script = `
        tell application "Music"
          if it is running then
            try
              return album of current track
            on error
              return ""
            end try
          else
            return ""
          end if
        end tell
      `;
      return execSync(`osascript -e '${script}'`, { encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  }

  private async getAlbumArt(): Promise<string> {
    // Tier 1: Try AppleScript artwork → base64
    const base64Art = await this.getAppleScriptArtworkBase64();
    if (base64Art) {
      this.log('✅ AppleScript artwork found!');
      return base64Art;
    }

    // Tier 2: Try iTunes API (most reliable for streaming music)
    const itunesArt = await this.getItunesArtwork();
    if (itunesArt) {
      this.log('✅ iTunes artwork found!');
      return itunesArt;
    }

    // Tier 3: Try Last.fm API (comprehensive database)
    const lastfmArt = await this.getLastfmArtwork();
    if (lastfmArt) {
      this.log('✅ Last.fm artwork found!');
      return lastfmArt;
    }

    // Tier 4: Try music-metadata on local file
    const metadataArt = await this.getMetadataArtwork();
    if (metadataArt) {
      this.log('✅ Metadata artwork found!');
      return metadataArt;
    }

    // Tier 5: Try cached artwork from Apple Music container
    const cachedArt = await this.getCachedArtwork();
    if (cachedArt) {
      this.log('✅ Cached artwork found!');
      return cachedArt;
    }

    this.log('❌ No album art found');
    return '';
  }

  private async getAppleScriptArtworkBase64(): Promise<string> {
    try {
      const script = `
        tell application "Music"
          if it is running then
            try
              set currentTrack to current track
              if (count of artworks of currentTrack) > 0 then
                set artworkData to data of artwork 1 of currentTrack
                set tempFile to (POSIX path of (path to temporary items)) & "album_art_" & (random number from 1000 to 9999) & ".jpg"
                set fileRef to open for access file tempFile with write permission
                set eof fileRef to 0
                write artworkData to fileRef
                close access fileRef
                return tempFile
              else
                return ""
              end if
            on error
              return ""
            end try
          else
            return ""
          end if
        end tell
      `;
      const result = execSync(`osascript -e '${script}'`, { encoding: 'utf8' }).trim();

      if (result && existsSync(result)) {
        const imageData = readFileSync(result);
        const base64 = imageData.toString('base64');
        return `data:image/jpeg;base64,${base64}`;
      }
      return '';
    } catch (error) {
      this.log('AppleScript artwork error: ' + (error instanceof Error ? error.message : 'Unknown error'));
      return '';
    }
  }

  private async getItunesArtwork(): Promise<string> {
    try {
      const title = this.getTrackTitle();
      const artist = this.getTrackArtist();
      const album = this.getTrackAlbum();

      if (!title || !artist) {
        return '';
      }

      // Try multiple search strategies
      const searchTerms = [
        `${artist} ${album || title}`,
        `${artist} ${title}`,
        `${title} ${artist}`
      ];

      for (const searchTerm of searchTerms) {
        const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=album&limit=1`;
        const response = await fetch(itunesUrl, {
          headers: {
            'User-Agent': 'AppleMusicNowPlaying/1.0 (contact@example.com)'
          }
        });
        
        if (response.ok) {
          const data = await response.json() as iTunesResponse;
          
          if (data.results && data.results.length > 0) {
            const result = data.results[0];
            const artworkUrl = result.artworkUrl100?.replace('100x100', '600x600');
            
            if (artworkUrl) {
              const imageResult = await this.fetchAndConvertImage(artworkUrl);
              if (imageResult) {
                return imageResult;
              }
            }
          }
        }
      }

      // Fallback: Try to find any album by the same artist
      this.log(`🎨 No exact match found, trying artist fallback for: ${artist}`);
      const artistUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&entity=album&limit=1`;
      this.log(`🔍 Artist fallback URL: ${artistUrl}`);
      const artistResponse = await fetch(artistUrl);
      
      if (artistResponse.ok) {
        const artistData = await artistResponse.json() as iTunesResponse;
        this.log(`🔍 Artist fallback response: ${artistData.resultCount} results`);
        
        if (artistData.results && artistData.results.length > 0) {
          const result = artistData.results[0];
          this.log(`🔍 Artist fallback result: ${result.artistName} - ${result.collectionName}`);
          const artworkUrl = result.artworkUrl100?.replace('100x100', '600x600');
          
          if (artworkUrl) {
            this.log(`🔍 Artist fallback artwork URL: ${artworkUrl}`);
            const imageResult = await this.fetchAndConvertImage(artworkUrl);
            if (imageResult) {
              this.log(`🎨 Artist fallback artwork found for: ${artist}`);
              return imageResult;
            }
          }
        }
      } else {
        this.log(`❌ Artist fallback API error: ${artistResponse.status}`);
      }

      return '';
    } catch (error) {
      this.log('iTunes artwork error: ' + (error instanceof Error ? error.message : 'Unknown error'));
      return '';
    }
  }

  private async getLastfmArtwork(): Promise<string> {
    try {
      const title = this.getTrackTitle();
      const artist = this.getTrackArtist();
      const album = this.getTrackAlbum();

      if (!title || !artist) {
        return '';
      }

      // Last.fm API key
      const API_KEY = process.env.LASTFM_API_KEY || '15ea39b489ea0fb56936a1573b5f6383';

      // Try multiple search strategies for Last.fm
      const searchStrategies = [
        // Strategy 1: Album search
        album ? `album=${encodeURIComponent(album)}&artist=${encodeURIComponent(artist)}` : null,
        // Strategy 2: Track search
        `track=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`,
        // Strategy 3: Artist search (fallback)
        `artist=${encodeURIComponent(artist)}`
      ].filter(Boolean);

      for (const searchParams of searchStrategies) {
        const lastfmUrl = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&${searchParams}&api_key=${API_KEY}&format=json`;
        this.log(`🔍 Last.fm search: ${searchParams}`);
        
        const response = await fetch(lastfmUrl, {
          headers: {
            'User-Agent': 'AppleMusicNowPlaying/1.0 (contact@example.com)'
          }
        });
        
        if (response.ok) {
          const data = await response.json() as LastFmResponse;
          
          if (data.album && data.album.image && data.album.image.length > 0) {
            // Get the largest available image
            const images = data.album.image;
            const largeImage = images.find((img: LastFmImage) => img.size === 'large') || 
                             images.find((img: LastFmImage) => img.size === 'medium') || 
                             images[images.length - 1];
            
            if (largeImage && largeImage['#text']) {
              const imageResult = await this.fetchAndConvertImage(largeImage['#text']);
              if (imageResult) {
                this.log(`🎨 Last.fm artwork found: ${data.album.name} by ${data.album.artist}`);
                return imageResult;
              }
            }
          }
        }
      }

      return '';
    } catch (error) {
      this.log('Last.fm artwork error: ' + (error instanceof Error ? error.message : 'Unknown error'));
      return '';
    }
  }

  private async getMetadataArtwork(): Promise<string> {
    try {
      const script = `
        tell application "Music"
          if it is running then
            try
              set currentTrack to current track
              set trackLocation to location of currentTrack
              return POSIX path of trackLocation
            on error
              return ""
            end try
          else
            return ""
          end if
        end tell
      `;
      const filePath = execSync(`osascript -e '${script}'`, { encoding: 'utf8' }).trim();

      if (filePath && existsSync(filePath)) {
        const metadata = await parseFile(filePath);
        if (metadata.common.picture && metadata.common.picture.length > 0) {
          const picture = metadata.common.picture[0];
          const base64 = Buffer.from(picture.data).toString('base64');
          return `data:${picture.format};base64,${base64}`;
        }
      }
      return '';
    } catch (error) {
      this.log('Metadata artwork error: ' + (error instanceof Error ? error.message : 'Unknown error'));
      return '';
    }
  }

  private async getCachedArtwork(): Promise<string> {
    try {
      const artworkPath = join(process.env.HOME || '', 'Library/Containers/com.apple.AMPMusic/Data/Documents/Artwork');

      if (existsSync(artworkPath)) {
        const files = readdirSync(artworkPath);
        // Get the most recently modified file
        const sortedFiles = files
          .map(file => ({
            name: file,
            path: join(artworkPath, file),
            mtime: statSync(join(artworkPath, file)).mtime
          }))
          .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

        if (sortedFiles.length > 0) {
          const latestFile = sortedFiles[0];
          const imageData = readFileSync(latestFile.path);
          const base64 = imageData.toString('base64');
          return `data:image/jpeg;base64,${base64}`;
        }
      }
      return '';
    } catch (error) {
      this.log('Cached artwork error: ' + (error instanceof Error ? error.message : 'Unknown error'));
      return '';
    }
  }

  private async fetchAndConvertImage(imageUrl: string): Promise<string> {
    try {
      const imageResponse = await fetch(imageUrl);
      
      if (imageResponse.ok) {
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64 = Buffer.from(imageBuffer).toString('base64');
        return `data:image/jpeg;base64,${base64}`;
      }
      return '';
    } catch (error) {
      this.log('Image fetch error: ' + (error instanceof Error ? error.message : 'Unknown error'));
      return '';
    }
  }

  private getSongDuration(): number {
    try {
      const script = `
        tell application "Music"
          if it is running then
            try
              return duration of current track
            on error
              return 0
            end try
          else
            return 0
          end if
        end tell
      `;
      const result = execSync(`osascript -e '${script}'`, { encoding: 'utf8' }).trim();
      return parseInt(result) || 0;
    } catch {
      return 0;
    }
  }

  private getSongPosition(): number {
    try {
      const script = `
        tell application "Music"
          if it is running then
            try
              return player position
            on error
              return 0
            end try
          else
            return 0
          end if
        end tell
      `;
      const result = execSync(`osascript -e '${script}'`, { encoding: 'utf8' }).trim();
      return parseFloat(result) || 0;
    } catch {
      return 0;
    }
  }

  private hasSongChanged(currentSong: SongData): boolean {
    if (!this.lastSongData) {
      return true;
    }

    return (
      this.lastSongData.title !== currentSong.title ||
      this.lastSongData.artist !== currentSong.artist ||
      this.lastSongData.album !== currentSong.album ||
      this.lastSongData.state !== currentSong.state
    );
  }

  private sendSongToDeskThing(song: SongData): void {
    try {
      // Send to DeskThing instead of console.log
      const payload = {
        version: 2,
        title: song.title,
        artist: song.artist,
        album: song.album,
        state: song.state,
        timestamp: Date.now(),
        albumArt: song.albumArt,
        duration: song.duration,
        position: song.position
      };

      DeskThing.send({ type: 'currentSong', payload });
      this.log('🎵 Current Song: ' + JSON.stringify(payload, null, 2));
    } catch (error) {
      this.log('Error processing song data: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}

// Create the app instance
const app = new AppleMusicNowPlaying();

// DeskThing event handlers
const startup = () => {
  console.log('🎵 Apple Music Now Playing server started!');
  app.start();
}

const stop = () => {
  console.log('🛑 Apple Music Now Playing server stopped');
  app.stop();
}

const purge = () => {
  console.log('🧹 Apple Music Now Playing server purged');
  app.stop();
}

// Register DeskThing event handlers
DeskThing.on('start', startup);
DeskThing.on('stop', stop);
DeskThing.on('purge', purge);