import Foundation
import HealthKit

// MARK: - HKWorkoutActivityType name (HealthKit has no built-in string)
extension HKWorkoutActivityType {
    var name: String {
        switch self {
        case .running: return "Running"
        case .cycling: return "Cycling"
        case .walking: return "Walking"
        case .swimming: return "Swimming"
        case .yoga: return "Yoga"
        case .functionalStrengthTraining: return "Functional Strength Training"
        case .traditionalStrengthTraining: return "Traditional Strength Training"
        case .highIntensityIntervalTraining: return "HIIT"
        case .elliptical: return "Elliptical"
        case .rowing: return "Rowing"
        case .stairClimbing: return "Stair Climbing"
        case .hiking: return "Hiking"
        case .dance: return "Dance"
        case .coreTraining: return "Core Training"
        case .pilates: return "Pilates"
        case .crossTraining: return "Cross Training"
        case .mixedCardio: return "Mixed Cardio"
        case .other: return "Other"
        default: return "Workout"
        }
    }
}

/// Reads workouts and activity summaries from Apple HealthKit
final class HealthKitService {
    private let healthStore = HKHealthStore()

    func requestAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw HealthKitError.notAvailable
        }

        let typesToRead: Set<HKObjectType> = [
            HKObjectType.workoutType(),
            HKObjectType.activitySummaryType(),
        ]

        try await healthStore.requestAuthorization(toShare: [], read: typesToRead)
    }

    func fetchWorkouts(days: Int = 14) async throws -> [WorkoutPayload] {
        let end = Date()
        let start = Calendar.current.date(byAdding: .day, value: -days, to: end)!
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: HKObjectType.workoutType(),
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]
            ) { _, samples, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                let workouts = (samples as? [HKWorkout]) ?? []
                let payloads = workouts.map { self.workoutToPayload($0) }
                continuation.resume(returning: payloads)
            }
            healthStore.execute(query)
        }
    }

    func fetchActivitySummaries(days: Int = 14) async throws -> [ActivitySummaryPayload] {
        let calendar = Calendar.current
        let end = Date()
        let start = calendar.date(byAdding: .day, value: -days, to: end)!
        var startComponents = calendar.dateComponents([.year, .month, .day, .era], from: calendar.startOfDay(for: start))
        startComponents.calendar = calendar
        var endComponents = calendar.dateComponents([.year, .month, .day, .era], from: end)
        endComponents.calendar = calendar
        let predicate = HKQuery.predicate(forActivitySummariesBetweenStart: startComponents, end: endComponents)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKActivitySummaryQuery(predicate: predicate) { _, summaries, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                let payloads = (summaries ?? []).map { self.summaryToPayload($0) }
                continuation.resume(returning: payloads)
            }
            healthStore.execute(query)
        }
    }

    private func workoutToPayload(_ workout: HKWorkout) -> WorkoutPayload {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        formatter.timeZone = TimeZone(identifier: "UTC")

        let activityType = workout.workoutActivityType.name
        let duration = Int(workout.duration)
        let calories = workout.totalEnergyBurned?.doubleValue(for: .kilocalorie())
        let distance = workout.totalDistance?.doubleValue(for: .meter())

        return WorkoutPayload(
            activityType: activityType,
            startDate: formatter.string(from: workout.startDate),
            endDate: formatter.string(from: workout.endDate),
            duration: duration,
            calories: calories,
            distance: distance,
            sourceName: workout.sourceRevision.source.name,
            sourceId: workout.uuid.uuidString
        )
    }

    private func summaryToPayload(_ summary: HKActivitySummary) -> ActivitySummaryPayload {
        let calendar = Calendar.current
        let dateComponents = summary.dateComponents(for: calendar)
        let year = dateComponents.year ?? 0
        let month = dateComponents.month ?? 0
        let day = dateComponents.day ?? 0
        let dateStr = String(format: "%04d-%02d-%02d", year, month, day)

        let activeEnergy = summary.activeEnergyBurned.doubleValue(for: .kilocalorie())
        let exerciseMinutes = summary.appleExerciseTime.doubleValue(for: .minute())
        let standHours = summary.appleStandHours.doubleValue(for: .count())

        return ActivitySummaryPayload(
            date: dateStr,
            activeEnergy: activeEnergy,
            exerciseMinutes: Int(exerciseMinutes),
            standHours: Int(standHours)
        )
    }
}

enum HealthKitError: Error {
    case notAvailable
}

// MARK: - Payload types (match your ingest API)

struct WorkoutPayload: Encodable {
    let activityType: String
    let startDate: String
    let endDate: String
    let duration: Int?
    let calories: Double?
    let distance: Double?
    let sourceName: String?
    let sourceId: String?
}

struct ActivitySummaryPayload: Encodable {
    let date: String
    let activeEnergy: Double?
    let exerciseMinutes: Int?
    let standHours: Int?
}
