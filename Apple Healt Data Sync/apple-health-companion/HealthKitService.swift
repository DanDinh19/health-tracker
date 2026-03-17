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

enum StepsRange: String, CaseIterable {
    case day = "D"
    case week = "W"
    case month = "M"
    case sixMonths = "6M"
    case year = "Y"
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
            HKObjectType.quantityType(forIdentifier: .stepCount)!,
        ]

        try await healthStore.requestAuthorization(toShare: [], read: typesToRead)
    }

    func fetchWorkouts(days: Int = 14) async throws -> [WorkoutPayload] {
        let end = Date()
        guard let start = Calendar.current.date(byAdding: .day, value: -days, to: end) else {
            throw HealthKitError.notAvailable
        }
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

    func fetchSteps(range: StepsRange) async throws -> [(label: String, steps: Int)] {
        guard let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            throw HealthKitError.notAvailable
        }
        let calendar = Calendar.current
        let end = Date()
        var start: Date!
        var queryEnd: Date!
        let interval: DateComponents
        switch range {
        case .day:
            // 12:00:01 AM to 11:59:59 PM
            guard let startOfDay = calendar.date(bySettingHour: 0, minute: 0, second: 0, of: end),
                  let dayStart = calendar.date(byAdding: .second, value: 1, to: startOfDay),
                  let dayEnd = calendar.date(bySettingHour: 23, minute: 59, second: 59, of: end) else {
                throw HealthKitError.notAvailable
            }
            start = dayStart
            queryEnd = dayEnd
            interval = DateComponents(hour: 1)
        case .week:
            guard let s = calendar.date(byAdding: .day, value: -7, to: end) else { throw HealthKitError.notAvailable }
            start = calendar.startOfDay(for: s)
            queryEnd = end
            interval = DateComponents(day: 1)
        case .month:
            guard let s = calendar.date(byAdding: .month, value: -1, to: end) else { throw HealthKitError.notAvailable }
            start = calendar.startOfDay(for: s)
            queryEnd = end
            interval = DateComponents(day: 1)
        case .sixMonths:
            guard let s = calendar.date(byAdding: .month, value: -6, to: end),
                  let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: s)) else {
                throw HealthKitError.notAvailable
            }
            start = startOfMonth
            queryEnd = end
            interval = DateComponents(month: 1)
        case .year:
            guard let s = calendar.date(byAdding: .year, value: -1, to: end),
                  let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: s)) else {
                throw HealthKitError.notAvailable
            }
            start = startOfMonth
            queryEnd = end
            interval = DateComponents(month: 1)
        }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: queryEnd, options: .strictStartDate)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsCollectionQuery(
                quantityType: stepType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum,
                anchorDate: start,
                intervalComponents: interval
            )
            query.initialResultsHandler = { _, results, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                var data: [(label: String, steps: Int)] = []
                let formatter = DateFormatter()
                formatter.timeZone = calendar.timeZone
                switch range {
                case .day:
                    formatter.dateFormat = "ha"
                case .week, .month:
                    formatter.dateFormat = "M/d"
                case .sixMonths, .year:
                    formatter.dateFormat = "MMM"
                }
                if range == .day {
                    var hourSteps: [Int: Int] = [:]
                    results?.enumerateStatistics(from: start, to: queryEnd) { statistics, _ in
                        let steps = Int(statistics.sumQuantity()?.doubleValue(for: .count()) ?? 0)
                        let hour = calendar.component(.hour, from: statistics.startDate)
                        hourSteps[hour] = steps
                    }
                    // 12am to 12am: 24 hours + end 12am for axis
                    for h in 0..<24 {
                        let label = h == 0 ? "12am" : h == 12 ? "12pm" : h < 12 ? "\(h)am" : "\(h - 12)pm"
                        data.append((label: label, steps: hourSteps[h] ?? 0))
                    }
                    data.append((label: "12am", steps: 0)) // end-of-day (duplicate label OK for axis span)
                } else {
                    var items: [(Date, Int)] = []
                    let now = Date()
                    let currentMonth = calendar.component(.month, from: now)
                    let currentYear = calendar.component(.year, from: now)
                    let todayDay = calendar.component(.day, from: now)
                    results?.enumerateStatistics(from: start, to: queryEnd) { statistics, _ in
                        var steps = Int(statistics.sumQuantity()?.doubleValue(for: .count()) ?? 0)
                        if range == .sixMonths {
                            let statMonth = calendar.component(.month, from: statistics.startDate)
                            let statYear = calendar.component(.year, from: statistics.startDate)
                            let daysInMonth = calendar.range(of: .day, in: .month, for: statistics.startDate)?.count ?? 30
                            if statMonth == currentMonth && statYear == currentYear {
                                let daysElapsed = max(1, todayDay)
                                steps = Int(Double(steps) / Double(daysElapsed))
                            } else {
                                steps = Int(Double(steps) / Double(daysInMonth))
                            }
                        } else if range == .year {
                            let statMonth = calendar.component(.month, from: statistics.startDate)
                            let statYear = calendar.component(.year, from: statistics.startDate)
                            let daysInMonth = calendar.range(of: .day, in: .month, for: statistics.startDate)?.count ?? 30
                            if statMonth == currentMonth && statYear == currentYear {
                                let daysElapsed = max(1, todayDay)
                                steps = Int(Double(steps) / Double(daysElapsed))
                            } else {
                                steps = Int(Double(steps) / Double(daysInMonth))
                            }
                        }
                        items.append((statistics.startDate, steps))
                    }
                    data = items.sorted { $0.0 < $1.0 }.map { (formatter.string(from: $0.0), $0.1) }
                }
                continuation.resume(returning: data)
            }
            healthStore.execute(query)
        }
    }

    func fetchStepsByHour(for date: Date) async throws -> [(hour: Int, steps: Int)] {
        guard let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            throw HealthKitError.notAvailable
        }
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        guard let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) else {
            throw HealthKitError.notAvailable
        }
        let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: endOfDay, options: .strictStartDate)
        let interval = DateComponents(hour: 1)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsCollectionQuery(
                quantityType: stepType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum,
                anchorDate: startOfDay,
                intervalComponents: interval
            )
            query.initialResultsHandler = { _, results, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                var data: [(hour: Int, steps: Int)] = []
                results?.enumerateStatistics(from: startOfDay, to: endOfDay) { statistics, _ in
                    let steps = Int(statistics.sumQuantity()?.doubleValue(for: .count()) ?? 0)
                    let hour = calendar.component(.hour, from: statistics.startDate)
                    data.append((hour: hour, steps: steps))
                }
                data.sort { $0.hour < $1.hour }
                continuation.resume(returning: data)
            }
            healthStore.execute(query)
        }
    }

    /// Average cumulative steps by hour (0–24) over the last N days, for the day chart baseline
    func fetchAverageCumulativeStepsByHour(lastDays: Int = 30) async throws -> [(hour: Double, cumulative: Int)] {
        guard let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            throw HealthKitError.notAvailable
        }
        let calendar = Calendar.current
        let end = Date()
        guard let start = calendar.date(byAdding: .day, value: -lastDays, to: end) else {
            throw HealthKitError.notAvailable
        }
        let startOfRange = calendar.startOfDay(for: start)
        let predicate = HKQuery.predicateForSamples(withStart: startOfRange, end: end, options: .strictStartDate)
        let interval = DateComponents(hour: 1)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsCollectionQuery(
                quantityType: stepType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum,
                anchorDate: startOfRange,
                intervalComponents: interval
            )
            query.initialResultsHandler = { _, results, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                var dayHourSteps: [String: [Int: Int]] = [:]
                results?.enumerateStatistics(from: startOfRange, to: end) { statistics, _ in
                    let steps = Int(statistics.sumQuantity()?.doubleValue(for: .count()) ?? 0)
                    let hour = calendar.component(.hour, from: statistics.startDate)
                    let dayKey = calendar.startOfDay(for: statistics.startDate).timeIntervalSince1970.description
                    dayHourSteps[dayKey, default: [:]][hour] = steps
                }
                var hourCumulatives: [Int: [Int]] = [:]
                for (_, hourSteps) in dayHourSteps {
                    var cum = 0
                    for h in 0..<24 {
                        cum += hourSteps[h] ?? 0
                        hourCumulatives[h, default: []].append(cum)
                    }
                    hourCumulatives[24, default: []].append(cum)
                }
                let dayCount = dayHourSteps.count
                guard dayCount > 0 else {
                    continuation.resume(returning: (0...24).map { (hour: Double($0), cumulative: 0) })
                    return
                }
                let data = (0...24).map { h -> (hour: Double, cumulative: Int) in
                    let vals = hourCumulatives[h] ?? []
                    let avg = vals.isEmpty ? 0 : vals.reduce(0, +) / vals.count
                    return (hour: Double(h), cumulative: avg)
                }
                continuation.resume(returning: data)
            }
            healthStore.execute(query)
        }
    }

    func fetchActivitySummaries(days: Int = 14) async throws -> [ActivitySummaryPayload] {
        let calendar = Calendar.current
        let end = Date()
        guard let start = calendar.date(byAdding: .day, value: -days, to: end) else {
            throw HealthKitError.notAvailable
        }
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
        let calories: Double?
        if #available(iOS 18.0, *), let energyType = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) {
            calories = workout.statistics(for: energyType)?.sumQuantity()?.doubleValue(for: .kilocalorie())
        } else {
            calories = workout.totalEnergyBurned?.doubleValue(for: .kilocalorie())
        }
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
