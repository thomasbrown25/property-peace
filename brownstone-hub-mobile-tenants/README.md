# Brownstone Hub Mobile - Tenant App

React Native mobile application for Brownstone Hub tenants using Expo and TypeScript.

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

2. Set up environment variables (optional):
   - Create a `.env` file if you want to override API URLs
   - The app will fetch Google Client ID from the backend automatically

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
brownstone-hub-mobile-tenants/
├── src/
│   ├── api/              # API service modules
│   ├── components/       # Reusable components (SimpleDrawer, GoogleLogo)
│   ├── config/           # Configuration files
│   ├── hooks/            # Custom hooks (useGoogleSignIn)
│   ├── navigation/       # Navigation setup
│   ├── screens/          # Screen components
│   │   ├── auth/         # Authentication screens
│   │   └── tenant/       # Tenant-specific screens
│   ├── services/         # Business logic services
│   ├── store/            # Redux store
│   └── types/            # TypeScript types
├── App.tsx               # Root component
└── package.json
```

## Features

- Authentication (Login, Register, Forgot Password, Google Sign-In)
- Dashboard
- My Lease
- Applications
- Maintenance Requests
- Payments
- Messages/Conversations
- Documents
- Settings

## Development

### Adding a New Screen

1. Create screen component in `src/screens/tenant/`
2. Add route to `MainNavigator` in `src/navigation/MainNavigator.tsx`
3. Update navigation types in `src/navigation/types.ts`

### API Integration

- API client is configured in `src/services/apiClient.ts`
- API modules are in `src/api/`
- Uses AsyncStorage for token management

### State Management

- Redux Toolkit for state management
- Store configured in `src/store/`
- Typed hooks available via `useAppDispatch` and `useAppSelector`

## Notes

- This app references the same backend API as the landlord app
- Uses the same shared code structure for consistency
- Tenant-specific screens and navigation are tailored for tenant users
