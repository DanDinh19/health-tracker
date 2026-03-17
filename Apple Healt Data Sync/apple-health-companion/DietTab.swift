import SwiftUI
import PhotosUI
import UIKit

// MARK: - Diet Tab (main)

struct DietTab: View {
    @State private var today: DietTodayResponse?
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var showLogSheet = false
    @State private var showCamera = false
    @State private var pendingCameraImage: UIImage?
    @State private var showURLAlert = false

    private let dietService = DietService()

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView("Loading…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let err = errorMessage {
                    VStack(spacing: 16) {
                        Text(err)
                            .font(.subheadline)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                            .padding()
                        Button("Retry") { Task { await loadToday() } }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let t = today {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 20) {
                            TodaySummaryCard(today: t)
                            MealsListView(meals: t.meals)
                        }
                        .padding()
                        .padding(.bottom, 80)
                    }
                } else {
                    Text("No data")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .navigationTitle("Diet")
            .task { await loadToday() }
            .refreshable { await loadToday() }
            .overlay(alignment: .bottom) {
                Button {
                    if (UserDefaults.standard.string(forKey: "ingestBaseURL") ?? "https://your-app.vercel.app").contains("your-app.vercel.app") {
                        showURLAlert = true
                    } else {
                        showLogSheet = true
                    }
                } label: {
                    Label("Log meal", systemImage: "camera.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.accentColor)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 16)
            }
            .sheet(isPresented: $showLogSheet) {
                MealLogSheet(
                    onSaved: {
                        showLogSheet = false
                        pendingCameraImage = nil
                        Task { await loadToday() }
                    },
                    initialImage: pendingCameraImage,
                    onRequestCamera: {
                        showLogSheet = false
                        showCamera = true
                    }
                )
                .onDisappear { pendingCameraImage = nil }
            }
            .fullScreenCover(isPresented: $showCamera) {
                ImagePicker(sourceType: .camera) { img in
                    showCamera = false
                    if let img {
                        pendingCameraImage = img
                        showLogSheet = true
                    }
                }
            }
            .alert("Configure URL first", isPresented: $showURLAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Go to Sync tab → Settings and add your web app URL and API key.")
            }
        }
    }

    private var baseURL: String {
        UserDefaults.standard.string(forKey: "ingestBaseURL") ?? "https://your-app.vercel.app"
    }

    private func loadToday() async {
        loading = true
        errorMessage = nil
        do {
            let t = try await dietService.fetchToday()
            await MainActor.run { today = t }
        } catch {
            await MainActor.run { errorMessage = error.localizedDescription }
        }
        await MainActor.run { loading = false }
    }
}

// MARK: - Today Summary Card

struct TodaySummaryCard: View {
    let today: DietTodayResponse

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Today")
                .font(.headline)
            Text("\(today.total_kcal) / \(today.target_kcal) kcal")
                .font(.title2)
                .fontWeight(.semibold)
            Text("\(Int(today.total_protein_g))g protein · \(Int(today.total_carbs_g))g carbs · \(Int(today.total_fat_g))g fat")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            HStack(spacing: 8) {
                MacroBar(value: today.total_protein_g, target: Double(today.target_protein_g), label: "P")
                MacroBar(value: today.total_carbs_g, target: Double(today.target_carbs_g), label: "C")
                MacroBar(value: today.total_fat_g, target: Double(today.target_fat_g), label: "F")
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct MacroBar: View {
    let value: Double
    let target: Double
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color(.systemGray5))
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.accentColor)
                        .frame(width: min(1, max(0, value / target)) * geo.size.width)
                }
            }
            .frame(height: 4)
        }
    }
}

// MARK: - Meals List

struct MealsListView: View {
    let meals: [String: [MealSummary]]

    private let order = ["breakfast", "lunch", "dinner", "snack"]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(order, id: \.self) { type in
                if let list = meals[type], !list.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(type.capitalized)
                            .font(.headline)
                        ForEach(list, id: \.id) { m in
                            MealRow(meal: m)
                        }
                    }
                }
            }
        }
    }
}

struct MealRow: View {
    let meal: MealSummary

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 6)
                .fill(Color(.systemGray5))
                .frame(width: 48, height: 48)
            VStack(alignment: .leading, spacing: 2) {
                Text(meal.short_description)
                    .font(.subheadline)
                    .lineLimit(2)
                Text(timeString(from: meal.timestamp))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text("\(Int(meal.total_kcal)) kcal")
                .font(.subheadline)
                .fontWeight(.medium)
        }
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func timeString(from iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: iso) else { return "" }
        let t = DateFormatter()
        t.timeStyle = .short
        return t.string(from: date)
    }
}
