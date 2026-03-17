import SwiftUI

// MARK: - Edit Meal Sheet

struct EditMealSheet: View {
    let mealId: String
    let onSaved: () -> Void
    let onDeleted: () -> Void
    let onCancel: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var meal: MealDetailResponse?
    @State private var items: [EditableMealItem] = []
    @State private var loading = true
    @State private var loadError: String?
    @State private var saving = false
    @State private var deleting = false
    @State private var saveError: String?
    @State private var showDeleteConfirm = false

    private let dietService = DietService()

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView("Loading…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let err = loadError {
                    VStack(spacing: 16) {
                        Text(err)
                            .font(.subheadline)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                            .padding()
                        Button("Close") { onCancel() }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let m = meal {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 20) {
                            Text("Edit meal")
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
                        .padding(.bottom, 120)
                    }
                } else {
                    EmptyView()
                }
            }
            .navigationTitle("Edit meal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { onCancel() }
                }
                ToolbarItem(placement: .destructiveAction) {
                    Button("Delete", role: .destructive) {
                        showDeleteConfirm = true
                    }
                    .disabled(meal == nil)
                }
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
                if meal != nil {
                    VStack(spacing: 8) {
                        Text("\(Int(totalKcal)) kcal · P \(Int(totalProteinG))g · C \(Int(totalCarbsG))g · F \(Int(totalFatG))g")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Button {
                            saving = true
                            saveError = nil
                            Task {
                                do {
                                    try await dietService.updateMeal(
                                        id: mealId,
                                        timestamp: meal!.timestamp,
                                        mealType: meal!.meal_type,
                                        items: items
                                    )
                                    await MainActor.run {
                                        onSaved()
                                        dismiss()
                                    }
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
                                Text("Save changes")
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
            }
            .alert("Delete meal?", isPresented: $showDeleteConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    deleting = true
                    Task {
                        do {
                            try await dietService.deleteMeal(id: mealId)
                            await MainActor.run {
                                onDeleted()
                                dismiss()
                            }
                        } catch {
                            await MainActor.run {
                                saveError = error.localizedDescription
                                deleting = false
                            }
                        }
                    }
                }
            } message: {
                Text("This action cannot be undone.")
            }
            .task { await loadMeal() }
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

    private func loadMeal() async {
        loading = true
        loadError = nil
        do {
            let m = try await dietService.fetchMeal(id: mealId)
            await MainActor.run {
                meal = m
                items = m.items.map { i in
                    EditableMealItem(
                        id: i.id,
                        name: i.food_name,
                        confidence: 0.5,
                        estimatedPortion: "\(i.quantity) \(i.unit)",
                        quantity: i.quantity,
                        unit: i.unit,
                        kcal: i.kcal,
                        proteinG: i.protein_g,
                        carbsG: i.carbs_g,
                        fatG: i.fat_g
                    )
                }
            }
        } catch {
            await MainActor.run { loadError = error.localizedDescription }
        }
        await MainActor.run { loading = false }
    }
}
