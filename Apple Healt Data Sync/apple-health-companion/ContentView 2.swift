import SwiftUI

struct ContentView: View {
    @State private var status: String = "Ready"
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

                Text("Health Tracker")
                    .font(.title)
                    .fontWeight(.semibold)

                Text("Sync your Apple Health data to your dashboard")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                Spacer()

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
                        Text(isSyncing ? "Syncing…" : "Sync")
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
        status = "Syncing…"

        do {
            let result = try await ingest.sync(days: 14)
            await MainActor.run {
                lastSync = result
                status = "Synced"
            }
        } catch {
            await MainActor.run {
                errorMessage = error.localizedDescription
                status = "Error"
            }
        }

        await MainActor.run {
            isSyncing = false
        }
    }
}

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
