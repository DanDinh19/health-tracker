import Foundation

// MARK: - Models

struct SleepBlockResponse: Decodable {
    let index: Int
    let startMinute: Int
    let endMinute: Int
    let stage: Int  // 1=deep, 2=light, 3=REM, 4=awake, 0=no data
}

struct OuraSleepLast24Response: Decodable {
    let blocks: [SleepBlockResponse]
    let windowStart: Double
    let windowEnd: Double
}

// MARK: - Oura Sleep Service

final class OuraSleepService {
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

    private let session = URLSession.shared

    func fetchSleepLast24() async throws -> OuraSleepLast24Response {
        guard !apiKey.isEmpty else { throw OuraSleepError.unauthorized }
        guard !baseURL.contains("your-app.vercel.app") else { throw OuraSleepError.invalidURL }

        guard let url = URL(string: "\(baseURL)/api/oura/sleep-last-24") else {
            throw OuraSleepError.invalidURL
        }
        var request = URLRequest(url: url)
        request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")

        let (data, response) = try await session.data(for: request)
        try checkResponse(response, data: data)
        return try JSONDecoder().decode(OuraSleepLast24Response.self, from: data)
    }

    private func checkResponse(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw OuraSleepError.invalidResponse }
        if http.statusCode == 401 { throw OuraSleepError.unauthorized }
        if http.statusCode == 400 {
            let body = try? JSONDecoder().decode([String: String].self, from: data)
            throw OuraSleepError.ouraNotConnected(body?["error"] ?? "Oura not connected")
        }
        if http.statusCode != 200 {
            var msg = (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
            if msg == nil, let body = String(data: data, encoding: .utf8), !body.isEmpty {
                msg = String(body.prefix(100))
            }
            throw OuraSleepError.serverError(status: http.statusCode, message: msg ?? "Request failed")
        }
    }
}

enum OuraSleepError: LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case ouraNotConnected(String)
    case serverError(status: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid web app URL. Configure in Sync → Settings."
        case .invalidResponse: return "Invalid server response"
        case .unauthorized: return "Add your API key in Settings."
        case .ouraNotConnected(let m): return m
        case .serverError(let s, let m): return "Server error \(s): \(m)"
        }
    }
}
