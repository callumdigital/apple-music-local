#!/usr/bin/env node

import { execSync } from 'node:child_process';

console.log('🎵 Testing Apple Music Integration...\n');

// Test 1: Check if Apple Music is running
console.log('1. Checking if Apple Music is running...');
try {
  const script = `
    tell application "Music"
      if it is running then
        return "running"
      else
        return "not running"
      end if
    end tell
  `;
  const result = execSync(`osascript -e '${script}'`, { encoding: 'utf8' }).trim();
  console.log(`   Apple Music status: ${result}`);
} catch (error) {
  console.log('   ❌ Error checking Apple Music status:', error.message);
}

// Test 2: Get current track info
console.log('\n2. Getting current track information...');
try {
  const script = `
    tell application "Music"
      if it is running then
        try
          set trackName to name of current track
          set artistName to artist of current track
          set albumName to album of current track
          set playerState to player state as string
          return trackName & "|" & artistName & "|" & albumName & "|" & playerState
        on error
          return "No track playing"
        end try
      else
        return "Apple Music not running"
      end if
    end tell
  `;
  const result = execSync(`osascript -e '${script}'`, { encoding: 'utf8' }).trim();
  
  if (result === "No track playing" || result === "Apple Music not running") {
    console.log(`   ❌ ${result}`);
  } else {
    const [title, artist, album, state] = result.split('|');
    console.log(`   ✅ Track: ${title}`);
    console.log(`   ✅ Artist: ${artist}`);
    console.log(`   ✅ Album: ${album}`);
    console.log(`   ✅ State: ${state}`);
  }
} catch (error) {
  console.log('   ❌ Error getting track info:', error.message);
}

// Test 3: Get player position
console.log('\n3. Getting player position...');
try {
  const script = `
    tell application "Music"
      if it is running then
        try
          set currentPos to player position
          set trackDuration to duration of current track
          return currentPos & "|" & trackDuration
        on error
          return "No track playing"
        end try
      else
        return "Apple Music not running"
      end if
    end tell
  `;
  const result = execSync(`osascript -e '${script}'`, { encoding: 'utf8' }).trim();
  
  if (result === "No track playing" || result === "Apple Music not running") {
    console.log(`   ❌ ${result}`);
  } else {
    const [position, duration] = result.split('|');
    console.log(`   ✅ Position: ${Math.floor(position)}s`);
    console.log(`   ✅ Duration: ${Math.floor(duration)}s`);
    console.log(`   ✅ Progress: ${Math.round((position / duration) * 100)}%`);
  }
} catch (error) {
  console.log('   ❌ Error getting position:', error.message);
}

// Test 4: Check for album art
console.log('\n4. Checking for album art...');
try {
  const script = `
    tell application "Music"
      if it is running then
        try
          set currentTrack to current track
          set artworkCount to count of artworks of currentTrack
          return artworkCount
        on error
          return "No track playing"
        end try
      else
        return "Apple Music not running"
      end if
    end tell
  `;
  const result = execSync(`osascript -e '${script}'`, { encoding: 'utf8' }).trim();
  
  if (result === "No track playing" || result === "Apple Music not running") {
    console.log(`   ❌ ${result}`);
  } else {
    console.log(`   ✅ Album art pieces found: ${result}`);
  }
} catch (error) {
  console.log('   ❌ Error checking album art:', error.message);
}

console.log('\n🎵 Apple Music integration test complete!');
console.log('\n💡 Tips:');
console.log('   - Make sure Apple Music is running');
console.log('   - Start playing a song in Apple Music');
console.log('   - Try different songs to test various scenarios');
