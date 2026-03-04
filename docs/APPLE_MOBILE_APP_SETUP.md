# Apple Health Companion App Setup

This guide walks you through building a native iOS companion app that reads Apple Health data and sends it to your Health Tracker web app (Supabase).

## Architecture

```
iPhone / Apple Watch
        ↓
   HealthKit (Swift)
        ↓
   POST /api/apple-health/ingest
        ↓
   Supabase (PostgreSQL)
        ↓
   Web app /dashboard/activities
```

## Prerequisites

- Xcode 15+
- Apple Developer account (for HealthKit capability)
- Your web app deployed (or ngrok for local testing)

---

## Step 1: Create a new iOS project

1. Open Xcode → **File → New → Project**
2. Choose **App** (iOS)
3. Product name: `HealthTrackerCompanion`
4. Interface: **SwiftUI**
5. Language: **Swift**
6. Save the project

---

## Step 2: Enable HealthKit

1. Select your project in the navigator
2. Select your app target → **Signing & Capabilities**
3. Click **+ Capability** → add **HealthKit**
4. Check **Clinical Health Records** if needed (optional)

5. Add privacy descriptions to **Info.plist**:

```xml
<key>NSHealthShareUsageDescription</key>
<string>Health Tracker needs to read your workouts and activity data to sync them to your dashboard.</string>
<key>NSHealthUpdateUsageDescription</key>
<string>Health Tracker may save synced data back to Health (optional).</string>
```

---

## Step 3: Add the source files

Copy the Swift files from `apple-health-companion/` into your Xcode project:

- `HealthKitService.swift` – reads workouts and activity summaries
- `IngestService.swift` – sends data to your web app
- `ContentView.swift` – UI with sync button (or merge into your existing ContentView)

---

## Step 4: Configure URL and API key

Open the app, tap the **gear icon** (Settings), and enter:

1. **Web app URL** – e.g. `https://your-app.vercel.app` (or your ngrok URL for local testing)
2. **API key** – from your web app (see Step 5)

For local testing with a physical device:

1. Run `ngrok http 3000` on your Mac
2. Use the ngrok URL: `https://abc123.ngrok.io`

---

## Step 5: Get your API key

1. Sign in to your web app
2. Go to **Dashboard → Activities**
3. Click **Generate API key**
4. Copy the key – you’ll enter it in the iOS app

---

## Step 6: Add API key

The companion app includes a **Settings** screen (gear icon). Paste your API key there. It is stored in `UserDefaults`; for production you may want to use Keychain.

---

## Step 7: Build and run

1. Connect your iPhone (HealthKit does not work in the simulator)
2. Select your device and run (⌘R)
3. Grant Health permissions when prompted
4. Tap **Sync** to send data to your web app

---

## Data flow

1. User opens the companion app
2. App requests HealthKit permissions (first run)
3. User taps **Sync**
4. App reads workouts and activity summaries from HealthKit
5. App POSTs JSON to `https://YOUR_APP/api/apple-health/ingest` with `X-API-Key` header
6. Web app stores data in Supabase
7. User views data at `/dashboard/activities`

---

## Payload format (matches your ingest API)

Your ingest API expects:

```json
{
  "workouts": [
    {
      "activityType": "Running",
      "startDate": "2025-02-28T07:00:00Z",
      "endDate": "2025-02-28T07:30:00Z",
      "duration": 1800,
      "calories": 280,
      "distance": 5000,
      "sourceName": "Apple Watch",
      "sourceId": "uuid"
    }
  ],
  "activitySummaries": [
    {
      "date": "2025-02-28",
      "activeEnergy": 450,
      "exerciseMinutes": 35,
      "standHours": 10
    }
  ]
}
```

The Swift code in `apple-health-companion/` builds this payload from HealthKit.

---

## Troubleshooting

- **HealthKit not available:** Use a real device; the simulator does not support HealthKit.
- **401 Unauthorized:** Check that the API key is correct and sent in the `X-API-Key` header.
- **No data syncing:** Ensure Health permissions are granted and there is data in the Health app.
- **App Transport Security:** For `http://` URLs, add an ATS exception in Info.plist (only for local dev).

---

## Optional: Supabase auth in the app

To avoid manual API key entry, you can add Supabase auth:

1. Add the Supabase Swift package: `https://github.com/supabase/supabase-swift`
2. Implement sign-in with the same Supabase project as your web app
3. After sign-in, call your web app to create/return an API key for the session
4. Use that key for the ingest API

This requires an extra endpoint on your web app to issue API keys for authenticated Supabase users.
