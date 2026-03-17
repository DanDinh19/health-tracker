import SwiftUI
import PhotosUI
import UIKit

// MARK: - Meal Log Sheet (camera / photo / analyze / review)

struct MealLogSheet: View {
    @Environment(\.dismiss) private var dismiss
    let onSaved: () -> Void
    var initialImage: UIImage? = nil
    var onRequestCamera: (() -> Void)? = nil

    @State private var showSourcePicker = true
    @State private var showPhotoPicker = false
    @State private var showCameraUnavailableAlert = false
    @State private var selectedImage: UIImage?
    @State private var analyzing = false
    @State private var analyzeError: String?
    @State private var analyzeResult: MealAnalyzeResponse?
    @State private var showReview = false

    private let dietService = DietService()

    var body: some View {
        NavigationStack {
            Group {
                if initialImage != nil || analyzing {
                    analyzingView
                } else if showSourcePicker && analyzeResult == nil {
                    sourcePickerView
                } else if let result = analyzeResult {
                    ReviewMealView(
                        result: result,
                        onSave: { saveItems in
                            try await saveMeal(items: saveItems)
                            await MainActor.run {
                                onSaved()
                                dismiss()
                            }
                        },
                        onCancel: {
                            analyzeResult = nil
                            selectedImage = nil
                            showSourcePicker = true
                        }
                    )
                } else {
                    EmptyView()
                }
            }
            .navigationTitle("Log meal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
        .sheet(isPresented: $showPhotoPicker) {
            PhotoLibraryPicker(selection: $photoPickerItem) {
                showPhotoPicker = false
            }
        }
        .onChange(of: photoPickerItem) { _, new in
            guard let new else { return }
            Task {
                if let data = try? await new.loadTransferable(type: Data.self),
                   let img = UIImage(data: data) {
                    await MainActor.run {
                        selectedImage = img
                        startAnalyze(img)
                    }
                }
            }
        }
        .onAppear {
            if let img = initialImage {
                startAnalyze(img)
            }
        }
        .alert("Camera unavailable", isPresented: $showCameraUnavailableAlert) {
            Button("Use photo library") {
                showPhotoPicker = true
            }
            Button("OK", role: .cancel) {}
        } message: {
            Text("The camera isn't available on this device (e.g. Simulator). Use \"Choose from library\" to select a photo instead.")
        }
    }

    @State private var photoPickerItem: PhotosPickerItem?

    private var sourcePickerView: some View {
        VStack(spacing: 24) {
            Spacer()
            Text("How would you like to log your meal?")
                .font(.headline)
                .multilineTextAlignment(.center)
            VStack(spacing: 12) {
                Button {
                    if UIImagePickerController.isSourceTypeAvailable(.camera) {
                        onRequestCamera?()
                    } else {
                        showCameraUnavailableAlert = true
                    }
                } label: {
                    Label("Take photo", systemImage: "camera.fill")
                        .frame(maxWidth: .infinity)
                        .padding()
                }
                .buttonStyle(.borderedProminent)
                Button {
                    showPhotoPicker = true
                } label: {
                    Label("Choose from library", systemImage: "photo.on.rectangle")
                        .frame(maxWidth: .infinity)
                        .padding()
                }
                .buttonStyle(.bordered)
                Button {
                    // TODO: Implement manual food search
                } label: {
                    Label("Search manually", systemImage: "magnifyingglass")
                        .frame(maxWidth: .infinity)
                        .padding()
                }
                .buttonStyle(.bordered)
                .disabled(true)
            }
            .padding(.horizontal, 32)
            Spacer()
        }
    }

    private var analyzingView: some View {
        VStack(spacing: 16) {
            Spacer()
            ProgressView()
                .scaleEffect(1.5)
            Text("Analyzing your meal…")
                .font(.headline)
            if let err = analyzeError {
                Text(err)
                    .font(.caption)
                    .foregroundStyle(.red)
                Button("Try again") {
                    analyzeError = nil
                    showSourcePicker = true
                }
            }
            Spacer()
        }
    }

    private func startAnalyze(_ image: UIImage) {
        guard let data = image.jpegData(compressionQuality: 0.7) else { return }
        analyzing = true
        analyzeError = nil
        Task {
            do {
                let mealType = guessMealType()
                let result = try await dietService.analyzeMeal(imageData: data, mealType: mealType)
                await MainActor.run {
                    analyzing = false
                    analyzeResult = result
                }
            } catch {
                await MainActor.run {
                    analyzing = false
                    analyzeError = error.localizedDescription
                }
            }
        }
    }

    private func guessMealType() -> String {
        let h = Calendar.current.component(.hour, from: Date())
        if h >= 5 && h < 11 { return "breakfast" }
        if h >= 11 && h < 15 { return "lunch" }
        if h >= 15 && h < 21 { return "dinner" }
        return "snack"
    }

    private func saveMeal(items: [EditableMealItem]) async throws {
        guard let result = analyzeResult else { return }
        try await dietService.saveMeal(
            timestamp: result.timestamp,
            mealType: result.meal_type,
            photoUrl: result.photo_url,
            items: items,
            notes: nil
        )
    }
}

// MARK: - Photo Library Picker

struct PhotoLibraryPicker: View {
    @Binding var selection: PhotosPickerItem?
    let onDismiss: () -> Void

    var body: some View {
        NavigationStack {
            VStack {
                PhotosPicker(selection: $selection, matching: .images) {
                    Label("Select photo", systemImage: "photo.on.rectangle")
                        .frame(maxWidth: .infinity)
                        .padding()
                }
                .onChange(of: selection) { _, _ in
                    if selection != nil { onDismiss() }
                }
                Spacer()
            }
            .navigationTitle("Choose photo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        selection = nil
                        onDismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Image Picker (Camera)

struct ImagePicker: UIViewControllerRepresentable {
    let sourceType: UIImagePickerController.SourceType
    let onImage: (UIImage?) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = sourceType
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onImage: onImage)
    }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onImage: (UIImage?) -> Void

        init(onImage: @escaping (UIImage?) -> Void) {
            self.onImage = onImage
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            let img = info[.originalImage] as? UIImage
            onImage(img)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onImage(nil)
        }
    }
}
