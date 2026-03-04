# Apple Health Data Setup

This guide explains how to ingest Apple Health data (from your iPhone and Apple Watch) into Supabase and display it in the Health Tracker app.

## Overview

Apple Health data lives on your device. Apple does not provide a cloud API. You have two main options:

### Option 1: Third-party app (recommended)

Use an iOS app that can sync Health data to a REST API:

- **[Health Auto Export](https://www.healthyapps.dev/)** – Sends data to a webhook URL
- **[HealthyApps](https://www.healthexportapp.com/)** – Similar export via API

### Option 2: Manual export

1. On iPhone: **Settings → Health → Export All Health Data**
2. You get `export.zip` with `export.xml`
3. Use a converter (e.g. [applehealthdata.com](https://applehealthdata.com/convert-apple-health-xml/)) to get JSON or CSV
4. Transform and POST to the ingest API (see below)

---

## Step 1: Create the database tables

Run this once:

```bash
npm run db:push
```

This creates the `apple_health_workouts`, `apple_health_records`, and `apple_health_activity_summaries` tables.

---

## Step 2: Get your ingest URL

Your ingest endpoint is:

```
https://YOUR_APP_URL/api/apple-health/ingest
```

For local development: `http://localhost:3000/api/apple-health/ingest`

**Important:** You must be signed in. The app uses the session cookie. For third-party apps, you'll need to add an API key or use a different auth method (see below).

---

## Step 3: Configure Health Auto Export (or similar)

1. Install **Health Auto Export** from the App Store
2. Open the app and grant Health permissions
3. Add a **REST API** automation
4. Set the URL to your ingest endpoint
5. Set **Method** to `POST`
6. Set **Content-Type** to `application/json`

### Auth for third-party apps

1. Go to **Dashboard → Activities** in the app
2. Click **Generate API key**
3. Copy the URL and API key
4. In Health Auto Export, add a header: `X-API-Key: YOUR_KEY`
5. Or use the query param: `?apiKey=YOUR_KEY` in the URL

---

## Step 4: Payload format

The ingest API expects JSON in this shape:

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
      "sourceId": "uuid-optional"
    }
  ],
  "activitySummaries": [
    {
      "date": "2025-02-28",
      "activeEnergy": 450,
      "exerciseMinutes": 35,
      "standHours": 10
    }
  ],
  "records": [
    {
      "type": "HKQuantityTypeIdentifierStepCount",
      "value": 8500,
      "unit": "count",
      "startDate": "2025-02-28T00:00:00Z",
      "sourceName": "iPhone"
    }
  ]
}
```

- **workouts**: Activity type, start/end, duration (seconds), calories, distance (meters)
- **activitySummaries**: Daily rings – date (YYYY-MM-DD), activeEnergy (kcal), exerciseMinutes, standHours
- **records**: Generic metrics (steps, heart rate, etc.)

---

## Step 5: View your data

1. Open the app and sign in
2. Go to **Activities** (or `/dashboard/activities`)
3. See workouts and activity summaries

---

## Data flow

```
iPhone/Apple Watch
       ↓
Health Auto Export (or similar)
       ↓
POST /api/apple-health/ingest
       ↓
Supabase (PostgreSQL)
       ↓
/dashboard/activities
```

---

## Troubleshooting

- **401 Unauthorized:** Ensure you're signed in when calling the ingest API. For third-party apps, implement API key auth.
- **Data not showing:** Check that the ingest URL is correct and the payload format matches.
- **Duplicate workouts:** Use `sourceId` for deduplication when the same workout can be sent multiple times.
