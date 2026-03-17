import Foundation

/// Sends HealthKit data to your Health Tracker web app
final class IngestService {
    private var baseURL: String {
        var raw = UserDefaults.standard.string(forKey: "ingestBaseURL") ?? "https://your-app.vercel.app"
        raw = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if !raw.hasPrefix("http://") && !raw.hasPrefix("https://") {
            raw = "https://" + raw
        }
        return raw.replacingOccurrences(of: "/$", with: "", options: .regularExpression)
    }
    private var apiKey: String {
        UserDefaults.standard.string(forKey: "appleHealthApiKey") ?? ""
    }

    private let healthKit = HealthKitService()
    private let session = URLSession.shared

    func sync(days: Int = 14) async throws -> SyncResult {
        guard !apiKey.isEmpty else {
            throw IngestError.unauthorized
        }
        guard !baseURL.contains("your-app.vercel.app") else {
            throw IngestError.invalidURL
        }
        try await healthKit.requestAuthorization()
        let workouts = try await healthKit.fetchWorkouts(days: days)
        let activitySummaries = try await healthKit.fetchActivitySummaries(days: days)

        let payload: [String: Any] = [
            "workouts": workouts.map { workoutToDict($0) },
            "activitySummaries": activitySummaries.map { summaryToDict($0) }
        ]

        let urlString = "\(baseURL)/api/apple-health/ingest"
        guard let url = URL(string: urlString), url.scheme == "https" || url.scheme == "http" else {
            throw IngestError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch let urlError as URLError where urlError.code == .unsupportedURL {
            throw IngestError.invalidURL
        } catch {
            throw error
        }

        guard let http = response as? HTTPURLResponse else {
            throw IngestError.invalidResponse
        }

        if http.statusCode == 401 {
            throw IngestError.unauthorized
        }

        if http.statusCode != 200 {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String ?? "Unknown error"
            throw IngestError.serverError(status: http.statusCode, message: message)
        }

        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let ingested = json?["ingested"] as? [String: Int]
        return SyncResult(
            workouts: ingested?["workouts"] ?? 0,
            activitySummaries: ingested?["activitySummaries"] ?? 0
        )
    }

    private func workoutToDict(_ w: WorkoutPayload) -> [String: Any] {
        var d: [String: Any] = [
            "activityType": w.activityType,
            "startDate": w.startDate,
            "endDate": w.endDate,
            "duration": w.duration ?? 0
        ]
        if let c = w.calories { d["calories"] = c }
        if let dist = w.distance { d["distance"] = dist }
        if let src = w.sourceName { d["sourceName"] = src }
        if let id = w.sourceId { d["sourceId"] = id }
        return d
    }

    private func summaryToDict(_ s: ActivitySummaryPayload) -> [String: Any] {
        var d: [String: Any] = ["date": s.date]
        if let e = s.activeEnergy { d["activeEnergy"] = e }
        if let m = s.exerciseMinutes { d["exerciseMinutes"] = m }
        if let h = s.standHours { d["standHours"] = h }
        return d
    }
}

struct SyncResult {
    let workouts: Int
    let activitySummaries: Int
}

enum IngestError: LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case serverError(status: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid web app URL. In Settings, use format: https://your-app.vercel.app"
        case .invalidResponse: return "Invalid server response"
        case .unauthorized: return "Add your API key in Settings. Generate one in your web app (Dashboard → Activities)."
        case .serverError(let status, let msg): return "Server error \(status): \(msg)"
        }
    }
}
