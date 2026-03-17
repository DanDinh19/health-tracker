import Foundation

// MARK: - Models

struct DietTodayResponse: Decodable {
    let date: String
    let total_kcal: Int
    let total_protein_g: Double
    let total_carbs_g: Double
    let total_fat_g: Double
    let target_kcal: Int
    let target_protein_g: Int
    let target_carbs_g: Int
    let target_fat_g: Int
    let meals: [String: [MealSummary]]
}

struct MealSummary: Decodable {
    let id: String
    let timestamp: String
    let meal_type: String
    let photo_url: String?
    let short_description: String
    let total_kcal: Double
}

struct MealAnalyzeItem: Decodable {
    let id: String
    let name: String
    let confidence: Double
    let estimated_portion: String
    let quantity: Double
    let unit: String
    let kcal: Double
    let protein_g: Double
    let carbs_g: Double
    let fat_g: Double
}

struct MealAnalyzeResponse: Decodable {
    let photo_url: String?
    let meal_type: String
    let timestamp: String
    let items: [MealAnalyzeItem]
    let total_kcal: Double
    let total_protein_g: Double
    let total_carbs_g: Double
    let total_fat_g: Double
}

// MARK: - Editable meal item (client-side)
struct EditableMealItem: Identifiable {
    let id: String
    var name: String
    var confidence: Double
    var estimatedPortion: String
    var quantity: Double
    var unit: String
    var kcal: Double
    var proteinG: Double
    var carbsG: Double
    var fatG: Double
}

// MARK: - DietService

final class DietService {
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

    func fetchToday(timezone: String = TimeZone.current.identifier) async throws -> DietTodayResponse {
        guard !apiKey.isEmpty else { throw DietError.unauthorized }
        guard !baseURL.contains("your-app.vercel.app") else { throw DietError.invalidURL }

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: timezone) ?? .current
        let dateStr = formatter.string(from: Date())
        var components = URLComponents(string: "\(baseURL)/api/diet/today")!
        components.queryItems = [
            URLQueryItem(name: "timezone", value: timezone),
            URLQueryItem(name: "date", value: dateStr),
        ]
        guard let url = components.url else { throw DietError.invalidURL }

        var request = URLRequest(url: url)
        request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")

        let (data, response) = try await session.data(for: request)
        try checkResponse(response, data: data)
        return try JSONDecoder().decode(DietTodayResponse.self, from: data)
    }

    func analyzeMeal(imageData: Data, mealType: String? = nil) async throws -> MealAnalyzeResponse {
        guard !apiKey.isEmpty else { throw DietError.unauthorized }
        guard !baseURL.contains("your-app.vercel.app") else { throw DietError.invalidURL }

        let url = URL(string: "\(baseURL)/api/meal/analyze")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")

        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        let timestamp = ISO8601DateFormatter().string(from: Date())
        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"image\"; filename=\"meal.jpg\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n".data(using: .utf8)!)
        if let mt = mealType {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"meal_type\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(mt)\r\n".data(using: .utf8)!)
        }
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"timestamp\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(timestamp)\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        let (data, response) = try await session.data(for: request)
        try checkResponse(response, data: data)
        return try JSONDecoder().decode(MealAnalyzeResponse.self, from: data)
    }

    func saveMeal(
        timestamp: String,
        mealType: String,
        photoUrl: String?,
        items: [EditableMealItem],
        notes: String?
    ) async throws {
        guard !apiKey.isEmpty else { throw DietError.unauthorized }
        guard !baseURL.contains("your-app.vercel.app") else { throw DietError.invalidURL }

        let url = URL(string: "\(baseURL)/api/meal")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")

        let payload: [String: Any] = [
            "timestamp": timestamp,
            "meal_type": mealType,
            "photo_url": photoUrl as Any,
            "notes": notes as Any,
            "items": items.map { item in
                [
                    "food_name": item.name,
                    "quantity": item.quantity,
                    "unit": item.unit,
                    "kcal": item.kcal,
                    "protein_g": item.proteinG,
                    "carbs_g": item.carbsG,
                    "fat_g": item.fatG,
                ] as [String: Any]
            },
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await session.data(for: request)
        try checkResponse(response, data: data)
    }

    private func checkResponse(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw DietError.invalidResponse }
        if http.statusCode == 401 { throw DietError.unauthorized }
        if http.statusCode != 200 {
            let msg = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String ?? "Unknown error"
            throw DietError.serverError(status: http.statusCode, message: msg)
        }
    }
}

enum DietError: LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case serverError(status: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid web app URL. Configure in Sync → Settings."
        case .invalidResponse: return "Invalid server response"
        case .unauthorized: return "Add your API key in Settings (Dashboard → Activities → Generate API key)."
        case .serverError(let s, let m): return "Server error \(s): \(m)"
        }
    }
}
