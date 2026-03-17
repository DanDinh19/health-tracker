//
//  ContentView.swift
//  Apple Healt Data Sync
//

import SwiftUI
import SafariServices
import Charts

// MARK: - Base URL helper
private var webBaseURL: String {
    var raw = UserDefaults.standard.string(forKey: "ingestBaseURL") ?? "https://your-app.vercel.app"
    raw = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    if !raw.hasPrefix("http://") && !raw.hasPrefix("https://") {
        raw = "https://" + raw
    }
    return raw.replacingOccurrences(of: "/$", with: "", options: .regularExpression)
}

// MARK: - Safari View (in-app browser)
struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}

// MARK: - Steps data for chart
struct StepsDataPoint: Identifiable {
    let id = UUID()
    let label: String
    let steps: Int
    let cumulative: Int
    /// Hour index (0–24) for day chart x-axis; nil for other ranges
    let hourValue: Double?
}

// MARK: - Summary tab (steps chart)
struct SummaryTab: View {
    @State private var stepsData: [StepsDataPoint] = []
    @State private var selectedRange: StepsRange = .day
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var showSafari = false
    @State private var showURLAlert = false
    @State private var blinkOpacity: Double = 1
    @State private var averageStepsData: [(hour: Double, cumulative: Int)] = []
    @State private var selectedBarLabel: String?

    private let healthKit = HealthKitService()
    private let lineWidth: CGFloat = 2

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Range tabs
                HStack(spacing: 0) {
                    ForEach(StepsRange.allCases, id: \.self) { range in
                        Button {
                            selectedRange = range
                            Task { await loadSteps() }
                        } label: {
                            Text(range.rawValue)
                                .font(.subheadline)
                                .fontWeight(selectedRange == range ? .semibold : .regular)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                                .padding(.horizontal, 4)
                                .background(selectedRange == range ? Color.accentColor.opacity(0.2) : Color.clear)
                                .foregroundStyle(selectedRange == range ? Color.accentColor : .primary)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 6)
                .background(Color(.systemGray6))

                if loading {
                    Spacer()
                    ProgressView("Loading steps…")
                    Spacer()
                } else if let err = errorMessage {
                    Spacer()
                    Text(err)
                        .font(.subheadline)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding()
                    Spacer()
                } else {
                    Text("Steps")
                        .font(.headline)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal)
                        .padding(.top, 8)
                    Group {
                        if selectedRange == .day, stepsData.contains(where: { $0.hourValue != nil }) {
                            Chart {
                                ForEach(Array(dayAverageLineData.enumerated()), id: \.offset) { _, point in
                                    LineMark(
                                        x: .value("Hour", point.hour),
                                        y: .value("Steps", point.cumulative),
                                        series: .value("Line", "30-day avg")
                                    )
                                    .foregroundStyle(by: .value("Series", "30-day avg"))
                                    .interpolationMethod(.catmullRom)
                                    .lineStyle(StrokeStyle(lineWidth: lineWidth))
                                }
                                ForEach(Array(dayLineData.enumerated()), id: \.offset) { _, point in
                                    LineMark(
                                        x: .value("Hour", point.hour),
                                        y: .value("Steps", point.cumulative),
                                        series: .value("Line", "Today")
                                    )
                                    .foregroundStyle(by: .value("Series", "Today"))
                                    .interpolationMethod(.catmullRom)
                                    .lineStyle(StrokeStyle(lineWidth: lineWidth * 1.5))
                                }
                                if let now = currentTimePosition {
                                    PointMark(
                                        x: .value("Hour", now.hour),
                                        y: .value("Steps", now.cumulative)
                                    )
                                    .foregroundStyle(.orange)
                                    .symbolSize(48)
                                    .opacity(blinkOpacity)
                                }
                            }
                            .chartForegroundStyleScale([
                                "Today": Color.blue,
                                "30-day avg": Color.gray.opacity(0.6)
                            ])
                            .chartXAxis {
                                AxisMarks(values: [0, 6, 12, 18, 24]) { value in
                                    AxisGridLine()
                                    AxisValueLabel {
                                        if let h = value.as(Double.self) {
                                            Text(hourLabel(for: h))
                                        }
                                    }
                                }
                            }
                            .onAppear {
                                guard selectedRange == .day else { return }
                                withAnimation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true)) {
                                    blinkOpacity = 0.35
                                }
                            }
                            .onChange(of: selectedRange) {
                                if selectedRange == .day {
                                    blinkOpacity = 1
                                    withAnimation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true)) {
                                        blinkOpacity = 0.35
                                    }
                                } else {
                                    blinkOpacity = 1
                                }
                            }
                        } else {
                            Chart(stepsData) { item in
                                BarMark(
                                    x: .value("Period", item.label),
                                    y: .value("Steps", item.steps)
                                )
                                .foregroundStyle(selectedBarLabel == item.label ? Color.accentColor.opacity(0.7) : Color.accentColor)
                            }
                            .chartOverlay { proxy in
                                GeometryReader { geo in
                                    Rectangle().fill(.clear).contentShape(Rectangle())
                                        .gesture(
                                            DragGesture(minimumDistance: 0)
                                                .onEnded { value in
                                                    let origin = geo[proxy.plotAreaFrame].origin
                                                    let plotLocation = CGPoint(
                                                        x: value.location.x - origin.x,
                                                        y: value.location.y - origin.y
                                                    )
                                                    if let (label, _) = proxy.value(at: plotLocation, as: (String, Int).self),
                                                       stepsData.contains(where: { $0.label == label }) {
                                                        selectedBarLabel = selectedBarLabel == label ? nil : label
                                                    } else {
                                                        selectedBarLabel = nil
                                                    }
                                                }
                                        )
                                }
                            }
                            .overlay(alignment: .top) {
                                if let label = selectedBarLabel,
                                   let item = stepsData.first(where: { $0.label == label }) {
                                    Text("\(label): \(item.steps.formatted()) steps")
                                        .font(.subheadline)
                                        .fontWeight(.medium)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 8))
                                        .padding(.top, 8)
                                }
                            }
                        }
                    }
                    .chartYAxisLabel(position: .leading, alignment: .center) {
                        Text("Steps")
                    }
                    .frame(height: 220)
                    .padding(.horizontal)
                    Spacer()
                }
            }
            .navigationTitle("Summary")
            .task {
                await loadSteps()
            }
            .refreshable {
                await loadSteps()
            }
            .overlay(alignment: .bottom) {
                if !loading && errorMessage == nil {
                    Button {
                        if webBaseURL.contains("your-app.vercel.app") {
                            showURLAlert = true
                        } else {
                            showSafari = true
                        }
                    } label: {
                        Label("Open full dashboard", systemImage: "safari")
                            .font(.subheadline)
                    }
                    .padding(.bottom, 16)
                }
            }
            .sheet(isPresented: $showSafari) {
                if let url = URL(string: webBaseURL + "/") {
                    SafariView(url: url)
                }
            }
            .alert("Configure URL first", isPresented: $showURLAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Go to Sync tab → Settings and add your web app URL.")
            }
        }
    }

    /// Average line data for day chart, full day 12AM–11:59PM (30-day average)
    private var dayAverageLineData: [(hour: Double, cumulative: Int)] {
        guard selectedRange == .day, !averageStepsData.isEmpty else { return [] }
        return averageStepsData
    }

    /// Line data for day chart, truncated at current time (no extrapolation beyond now)
    private var dayLineData: [(hour: Double, cumulative: Int)] {
        guard selectedRange == .day, !stepsData.isEmpty else { return [] }
        let now = currentTimePosition
        let currentHour = now?.hour ?? 24
        var points = stepsData.compactMap { item -> (Double, Int)? in
            guard let h = item.hourValue, h <= currentHour else { return nil }
            return (h, item.cumulative)
        }
        if let now = now, let last = points.last, abs(last.0 - now.hour) > 0.01 {
            points.append((now.hour, now.cumulative))
        }
        return points
    }

    private var currentTimePosition: (hour: Double, cumulative: Int)? {
        guard selectedRange == .day, !stepsData.isEmpty else { return nil }
        let calendar = Calendar.current
        let now = Date()
        let hour = Double(calendar.component(.hour, from: now))
        let minute = Double(calendar.component(.minute, from: now))
        let currentHour = hour + minute / 60
        let h0 = Int(floor(currentHour))
        let h1 = min(h0 + 1, 24)
        let frac = currentHour - Double(h0)
        let y0 = stepsData.first { ($0.hourValue ?? -1) == Double(h0) }?.cumulative ?? 0
        let y1 = stepsData.first { ($0.hourValue ?? -1) == Double(h1) }?.cumulative ?? y0
        let interpolated = Int(Double(y0) + Double(y1 - y0) * frac)
        return (currentHour, interpolated)
    }

    private func hourLabel(for hour: Double) -> String {
        switch Int(hour) {
        case 0, 24: return "12AM"
        case 6: return "6AM"
        case 12: return "12PM"
        case 18: return "6PM"
        default: return "\(Int(hour))"
        }
    }

    private func loadSteps() async {
        loading = true
        errorMessage = nil
        do {
            try await healthKit.requestAuthorization()
            let data = try await healthKit.fetchSteps(range: selectedRange)
            await MainActor.run {
                var cum = 0
                let isDay = selectedRange == .day
                stepsData = data.enumerated().map { index, item in
                    cum += item.steps
                    return StepsDataPoint(
                        label: item.label,
                        steps: item.steps,
                        cumulative: cum,
                        hourValue: isDay ? Double(index) : nil
                    )
                }
            }
            if selectedRange == .day {
                let avg = try await healthKit.fetchAverageCumulativeStepsByHour(lastDays: 30)
                await MainActor.run { averageStepsData = avg }
            } else {
                await MainActor.run { averageStepsData = [] }
            }
        } catch {
            await MainActor.run {
                errorMessage = error.localizedDescription
                stepsData = []
                averageStepsData = []
            }
        }
        await MainActor.run { loading = false }
    }
}

// MARK: - Web link tab (opens dashboard page)
struct WebLinkTab: View {
    let title: String
    let icon: String
    let path: String
    @State private var showSafari = false
    @State private var showURLAlert = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()
                Image(systemName: icon)
                    .font(.system(size: 50))
                    .foregroundStyle(.secondary)
                Text(title)
                    .font(.title2)
                    .fontWeight(.semibold)
                Text("View your \(title.lowercased()) data on the web dashboard")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
                Button {
                    if webBaseURL.contains("your-app.vercel.app") {
                        showURLAlert = true
                    } else {
                        showSafari = true
                    }
                } label: {
                    Label("Open in browser", systemImage: "safari")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.accentColor)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(.horizontal, 32)
                Spacer()
            }
            .navigationTitle(title)
            .sheet(isPresented: $showSafari) {
                if let url = URL(string: webBaseURL + path) {
                    SafariView(url: url)
                }
            }
            .alert("Configure URL first", isPresented: $showURLAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Go to Sync tab → Settings and add your web app URL.")
            }
        }
    }
}

// MARK: - Sync tab
struct SyncTab: View {
    @State private var isSyncing = false
    @State private var lastSync: SyncResult?
    @State private var errorMessage: String?
    @State private var showSettings = false

    private let ingest = IngestService()

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()
                Image(systemName: "heart.fill")
                    .font(.system(size: 60))
                    .foregroundStyle(.red)
                Text("Sync")
                    .font(.title2)
                    .fontWeight(.semibold)
                Text("Sync your Apple Health data to your dashboard")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
                if let err = errorMessage {
                    Text(err)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .padding(.horizontal)
                }
                if let r = lastSync {
                    Text("Last sync: \(r.workouts) workouts, \(r.activitySummaries) activity days")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Button {
                    Task { await sync() }
                } label: {
                    HStack {
                        if isSyncing {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Image(systemName: "arrow.triangle.2.circlepath")
                        }
                        Text(isSyncing ? "Syncing…" : "Sync now")
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(isSyncing ? Color.gray : Color.accentColor)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(isSyncing)
                .padding(.horizontal, 32)
                Spacer()
            }
            .navigationTitle("Sync")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                }
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
        }
    }

    private func sync() async {
        isSyncing = true
        errorMessage = nil
        do {
            let result = try await ingest.sync(days: 14)
            await MainActor.run { lastSync = result }
        } catch {
            await MainActor.run { errorMessage = error.localizedDescription }
        }
        await MainActor.run { isSyncing = false }
    }
}

// MARK: - Main tab view
struct ContentView: View {
    var body: some View {
        TabView {
            SummaryTab()
                .tabItem {
                    Label("Summary", systemImage: "chart.bar.fill")
                }
            WebLinkTab(title: "Activity", icon: "figure.run", path: "/dashboard/activities")
                .tabItem {
                    Label("Activity", systemImage: "figure.run")
                }
            DietTab()
                .tabItem {
                    Label("Diet", systemImage: "fork.knife")
                }
            WebLinkTab(title: "Sleep", icon: "bed.double.fill", path: "/dashboard/sleep")
                .tabItem {
                    Label("Sleep", systemImage: "bed.double.fill")
                }
            SyncTab()
                .tabItem {
                    Label("Sync", systemImage: "arrow.triangle.2.circlepath")
                }
        }
    }
}

// MARK: - Settings
struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("appleHealthApiKey") private var apiKey = ""
    @AppStorage("ingestBaseURL") private var baseURL = "https://your-app.vercel.app"

    var body: some View {
        NavigationStack {
            Form {
                Section("Web app URL") {
                    TextField("https://your-app.vercel.app", text: $baseURL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                Section("API key") {
                    SecureField("Paste your API key", text: $apiKey)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                Section {
                    Text("Get your API key from Dashboard → Activities → Generate API key in your web app.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

#Preview {
    ContentView()
}
