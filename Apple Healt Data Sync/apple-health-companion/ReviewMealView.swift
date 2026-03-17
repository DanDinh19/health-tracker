import SwiftUI

// MARK: - Review Meal View

struct ReviewMealView: View {
    let result: MealAnalyzeResponse
    let onSave: ([EditableMealItem]) async throws -> Void
    let onCancel: () -> Void

    @State private var items: [EditableMealItem] = []
    @State private var saving = false
    @State private var saveError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Review your meal")
                    .font(.title2)
                    .fontWeight(.semibold)
                mealTotalsCard
                ForEach(items.indices, id: \.self) { index in
                    MealItemCard(
                        item: $items[index],
                        onDelete: { items.removeAll { $0.id == items[index].id } }
                    )
                }
            }
            .padding()
            .padding(.bottom, 100)
        }
        .overlay(alignment: .top) {
            if let err = saveError {
                Text(err)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(8)
                    .background(Color.red.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .padding()
            }
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 8) {
                Text("\(Int(totalKcal)) kcal · P \(Int(totalProteinG))g · C \(Int(totalCarbsG))g · F \(Int(totalFatG))g")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button {
                    saving = true
                    saveError = nil
                    Task {
                        do {
                            try await onSave(items)
                        } catch {
                            await MainActor.run {
                                saveError = error.localizedDescription
                                saving = false
                            }
                        }
                    }
                } label: {
                    if saving {
                        ProgressView()
                            .tint(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                    } else {
                        Text("Save to diary")
                            .frame(maxWidth: .infinity)
                            .padding()
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(saving || items.isEmpty)
            }
            .padding()
            .background(.regularMaterial)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Back") { onCancel() }
            }
        }
        .onAppear {
            items = result.items.map { i in
                EditableMealItem(
                    id: i.id,
                    name: i.name,
                    confidence: i.confidence,
                    estimatedPortion: i.estimated_portion,
                    quantity: i.quantity,
                    unit: i.unit,
                    kcal: i.kcal,
                    proteinG: i.protein_g,
                    carbsG: i.carbs_g,
                    fatG: i.fat_g
                )
            }
        }
    }

    private var totalKcal: Double { items.reduce(0) { $0 + $1.kcal } }
    private var totalProteinG: Double { items.reduce(0) { $0 + $1.proteinG } }
    private var totalCarbsG: Double { items.reduce(0) { $0 + $1.carbsG } }
    private var totalFatG: Double { items.reduce(0) { $0 + $1.fatG } }

    private var mealTotalsCard: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(Int(totalKcal)) kcal")
                    .font(.title2)
                    .fontWeight(.semibold)
                Text("P \(Int(totalProteinG))g · C \(Int(totalCarbsG))g · F \(Int(totalFatG))g")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding()
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - Meal Item Card

struct MealItemCard: View {
    @Binding var item: EditableMealItem
    let onDelete: () -> Void
    var thumbnailURL: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                itemThumbnail
                VStack(alignment: .leading, spacing: 2) {
                    TextField("Food name", text: $item.name)
                        .font(.subheadline)
                    confidencePill(confidence: item.confidence)
                }
                Spacer()
                Button(role: .destructive) { onDelete() } label: {
                    Image(systemName: "trash")
                }
            }
            HStack {
                Stepper(value: $item.quantity, in: 0.25...20, step: 0.25) {
                    Text("\(item.quantity, specifier: "%.2g") \(item.unit)")
                        .font(.subheadline)
                }
                .onChange(of: item.quantity) { oldQty, newQty in
                    let ratio = newQty / max(0.01, oldQty)
                    item.kcal *= ratio
                    item.proteinG *= ratio
                    item.carbsG *= ratio
                    item.fatG *= ratio
                }
                Spacer()
                Text("\(Int(item.kcal)) kcal")
                    .font(.subheadline)
                    .fontWeight(.medium)
            }
            Text("P \(Int(item.proteinG))g · C \(Int(item.carbsG))g · F \(Int(item.fatG))g")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    @ViewBuilder
    private var itemThumbnail: some View {
        if let urlString = thumbnailURL,
           !urlString.contains("placeholder"),
           let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                case .failure, .empty:
                    thumbnailPlaceholder
                @unknown default:
                    thumbnailPlaceholder
                }
            }
            .frame(width: 40, height: 40)
            .clipShape(RoundedRectangle(cornerRadius: 6))
        } else {
            thumbnailPlaceholder
        }
    }

    private var thumbnailPlaceholder: some View {
        RoundedRectangle(cornerRadius: 6)
            .fill(Color(.systemGray5))
            .frame(width: 40, height: 40)
    }

    private func confidencePill(confidence: Double) -> some View {
        let (label, color) = confidence >= 0.8 ? ("Likely", Color.green) : confidence >= 0.5 ? ("Unsure", Color.orange) : ("Low", Color.red)
        return Text(label)
            .font(.caption2)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.2))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
}
