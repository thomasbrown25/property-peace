# Property Peace Mobile App

React Native mobile application for Property Peace using Expo and TypeScript.

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your mobile device (for testing)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Update API URLs if needed (defaults to localhost:5001)

3. Start the development server:
```bash
npm start
```

4. Run on your device:
   - Install Expo Go app on your iOS/Android device
   - Scan the QR code from the terminal/Expo Dev Tools
   - Or press `i` for iOS simulator, `a` for Android emulator

## Project Structure

```
property-peace-mobile/
├── src/
│   ├── api/              # API service modules
│   ├── components/       # Reusable components
│   ├── config/           # Configuration files
│   ├── navigation/       # Navigation setup
│   ├── screens/          # Screen components
│   ├── services/         # Business logic services
│   ├── store/            # Redux store
│   └── types/            # TypeScript types
├── App.tsx               # Root component
└── package.json
```

## Features

- Authentication (Login, Register, Forgot Password)
- Dashboard
- Properties Management
- Leases Management
- Messages/Conversations
- Settings

## Development

### Adding a New Screen

1. Create screen component in `src/screens/`
2. Add route to appropriate navigator in `src/navigation/`
3. Update navigation types in `src/navigation/types.ts`

### API Integration

- API client is configured in `src/services/apiClient.ts`
- API modules are in `src/api/`
- Uses AsyncStorage for token management

### State Management

- Redux Toolkit for state management
- Store configured in `src/store/`
- Typed hooks available via `useAppDispatch` and `useAppSelector`

## Building for Production

```bash
# iOS
expo build:ios

# Android
expo build:android
```

## Notes

- For physical device testing, update API_URL in `.env` to use your computer's local IP address instead of localhost
- SignalR is configured but requires backend setup
- CORS must be configured in backend to allow Expo development URLs
