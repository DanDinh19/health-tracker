# Apple Health Companion – Quick Start

Native iOS app that reads Apple Health data and syncs it to your Health Tracker web app (Supabase).

## What You Need

- Xcode 15+
- Apple Developer account (signed in)
- iPhone (HealthKit does not work in the simulator)
- Health Tracker web app deployed (e.g. on Vercel)

---

## 1. Create the Xcode Project

1. Open Xcode → **File → New → Project**
2. Select **iOS** → **App** → Next
3. Fill in:
   - **Product Name:** `HealthTrackerCompanion`
   - **Team:** Your Apple Developer team
   - **Organization Identifier:** e.g. `com.yourname`
   - **Interface:** SwiftUI
   - **Language:** Swift
4. Save the project

---

## 2. Enable HealthKit

1. Select the project (blue icon) in the left sidebar
2. Select the **HealthTrackerCompanion** target
3. Open the **Signing & Capabilities** tab
4. Click **+ Capability**
5. Search for and add **HealthKit**

---

## 3. Add Privacy Descriptions

1. Still in the target, open the **Info** tab (or add/edit `Info.plist`)
2. Right-click → **Add Row**, or click the **+** button
3. Add:

| Key | Type | Value |
|-----|------|-------|
| `Privacy - Health Share Usage Description` | String | `Health Tracker needs to read your workouts and activity data to sync them to your dashboard.` |
| `Privacy - Health Update Usage Description` | String | `Health Tracker may save synced data back to Health (optional).` |

*(The raw keys are `NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription`.)*

---

## 4. Add the Swift Files

1. In Finder, go to `health-tracker/apple-health-companion/`
2. In Xcode, right-click the **HealthTrackerCompanion** group (or the project) in the navigator
3. Choose **Add Files to "HealthTrackerCompanion"...**
4. Select all three files:
   - `HealthKitService.swift`
   - `IngestService.swift`
   - `ContentView.swift`
5. **Uncheck** “Copy items if needed” if the project is inside `health-tracker`; otherwise check it
6. Ensure **HealthTrackerCompanion** target is checked
7. Click **Add**

8. **Replace** the default `ContentView.swift`: If Xcode created its own ContentView, delete it first or overwrite it with the one from `apple-health-companion/`. Keep only one ContentView.

---

## 5. Configure the App Entry Point

The default Xcode App template creates something like:

```swift
@main
struct HealthTrackerCompanionApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

If your `ContentView` is the one from this folder, this will work as-is. The app will show our sync UI.

---

## 6. Build and Run on Device

1. Connect your iPhone via USB
2. Select your iPhone from the device dropdown (next to the Run button)
3. Click **Run** (⌘R)
4. On first launch, you may need to trust the developer: **Settings → General → VPN & Device Management**
5. When prompted, grant Health access

---

## 7. Configure Settings

1. In the app, tap the **gear icon** (Settings)
2. **Web app URL:** Your deployed URL, e.g. `https://health-tracker-xxx.vercel.app`
3. **API key:** From your web app:
   - Sign in at your Health Tracker URL
   - Go to **Dashboard → Activities**
   - Click **Generate API key**
   - Copy and paste into the iOS app

4. Tap **Done**

---

## 8. Sync

1. Tap **Sync**
2. Approve Health permissions if asked
3. Data (workouts + activity rings) is sent to your web app and stored in Supabase
4. View it at `/dashboard/activities` on your web app

---

## Data Flow

```
iPhone Health app
       ↓
HealthKit (HealthKitService.swift)
       ↓
IngestService.swift
       ↓
POST /api/apple-health/ingest (your web app)
       ↓
Prisma → Supabase PostgreSQL
       ↓
/dashboard/activities
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "HealthKit not available" | Use a real iPhone; simulator does not support HealthKit |
| 401 Unauthorized | Verify API key in Settings; regenerate if needed |
| No data after sync | Confirm Health permissions and that you have workouts/activity data in the Health app |
| Build fails on signing | Select your Team in Signing & Capabilities and ensure a valid provisioning profile |
