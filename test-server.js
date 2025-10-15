#!/usr/bin/env node

// Simple test to verify our Apple Music logic works
import { execSync } from 'node:child_process';

console.log('🎵 Testing Apple Music Server Logic...\n');

function getPlayerState() {
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

function getTrackTitle() {
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

function getTrackArtist() {
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

function getTrackAlbum() {
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

function getSongDuration() {
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

function getSongPosition() {
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

function getBasicSongInfo() {
  try {
    const playerState = getPlayerState();
    if (playerState === 'stopped') {
      return null;
    }

    const title = getTrackTitle();
    const artist = getTrackArtist();
    const album = getTrackAlbum();
    const duration = getSongDuration();
    const position = getSongPosition();

    if (!title || !artist) {
      return null;
    }

    return {
      title,
      artist,
      album: album || 'Unknown Album',
      state: playerState,
      duration: duration > 0 ? duration : undefined,
      position: position > 0 ? position : undefined
    };
  } catch (error) {
    console.log('Error getting basic song info:', error);
    return null;
  }
}

// Test the logic
console.log('Testing song info retrieval...');
const songInfo = getBasicSongInfo();

if (songInfo) {
  console.log('✅ Song info retrieved successfully:');
  console.log(`   Title: ${songInfo.title}`);
  console.log(`   Artist: ${songInfo.artist}`);
  console.log(`   Album: ${songInfo.album}`);
  console.log(`   State: ${songInfo.state}`);
  console.log(`   Duration: ${songInfo.duration}s`);
  console.log(`   Position: ${songInfo.position}s`);
  
  if (songInfo.duration && songInfo.position) {
    const progress = (songInfo.position / songInfo.duration) * 100;
    console.log(`   Progress: ${Math.round(progress)}%`);
  }
} else {
  console.log('❌ No song info available');
  console.log('   Make sure Apple Music is running and playing a song');
}

console.log('\n🎵 Server logic test complete!');