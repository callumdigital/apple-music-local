# Apple Music Local - DeskThing App

A real-time Apple Music integration app for DeskThing that displays current playback information with dynamic album art and progress tracking.

## Features

- 🎵 **Real-time Apple Music integration** via AppleScript
- 🎨 **Dynamic background colors** extracted from album art
- ⏯️ **Progress bar** that stops/starts with music playback
- 🖼️ **Album artwork** with multiple fallback sources (AppleScript, iTunes API, Last.fm, local metadata)
- 📱 **Responsive design** optimized for DeskThing displays
- 🔄 **Auto-refresh** every 2 seconds
- 🎯 **Smooth animations** between song changes

## Installation

1. Install the app through DeskThing's app store or by importing the ZIP file
2. Make sure Apple Music is running on your Mac
3. The app will automatically connect and start displaying current playback

## Requirements

- macOS (ARM or Intel)
- Apple Music app
- DeskThing device
- Node.js (for development)

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## How It Works

The app uses AppleScript to communicate with Apple Music and fetch:
- Current track information (title, artist, album)
- Playback state (playing/paused)
- Progress position and duration
- Album artwork (with multiple fallback methods)

The client-side React app polls the server every 2 seconds for updates and provides smooth progress simulation between server updates.

## License

MIT License - feel free to modify and distribute!