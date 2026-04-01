#!/usr/bin/env swift
import Foundation
import AppKit
import ApplicationServices
import Vision

struct Payload: Decodable {
    let expectedChatTitle: String?
    let text: String?
    let sendMode: String?
    let observeSeconds: Int?
    let pollSeconds: Int?
    let screenshotBeforePath: String?
    let screenshotAfterPath: String?
}

struct WindowFrame: Codable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct LoopResult: Codable {
    let ok: Bool
    let transport: String
    let expectedChatTitle: String?
    let targetSelectionAttempted: Bool
    let targetMatchedHeuristic: Bool
    let searchQueryApplied: Bool
    let sidebarVisibleRows: Int
    let selectedRowIndex: Int?
    let headerTextObserved: [String]
    let windowTitle: String
    let windowFrame: WindowFrame?
    let transcriptBefore: String
    let transcriptAfterSend: String
    let transcriptAfterReply: String
    let replyObserved: Bool
    let screenshotBeforePath: String?
    let screenshotAfterPath: String?
    let error: String?
}

struct ReadinessResult: Codable {
    let ok: Bool
    let ready: Bool
    let transport: String
    let accessibilityTrusted: Bool
    let lineRunning: Bool
    let contextResolved: Bool
    let expectedChatTitle: String?
    let expectedTitleMatched: Bool?
    let targetSelectionAttempted: Bool?
    let targetMatchedHeuristic: Bool?
    let searchQueryApplied: Bool?
    let sidebarVisibleRows: Int?
    let headerTextObserved: [String]
    let windowTitle: String?
    let windowFrame: WindowFrame?
    let selectedRowIndex: Int?
    let error: String?
}

enum BridgeError: Error {
    case lineNotRunning
    case windowNotFound
    case contextNotFound(String)
    case targetSelectionFailed(String)
    case screenshotFailed(String)
    case unsupportedCommand(String)
}

struct UIContext {
    let app: NSRunningApplication
    let window: AXUIElement
    let windowTitle: String
    let windowFrame: CGRect?
    let rootSplit: AXUIElement
    let mainSplit: AXUIElement
    let sidebarList: AXUIElement
    let transcriptList: AXUIElement
    let searchField: AXUIElement
    let composerField: AXUIElement
}

func attr(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    var value: CFTypeRef?
    let error = AXUIElementCopyAttributeValue(element, name as CFString, &value)
    guard error == .success else { return nil }
    return value
}

func arrayAttr(_ element: AXUIElement, _ name: String) -> [AXUIElement] {
    (attr(element, name) as? [AXUIElement]) ?? []
}

func stringAttr(_ element: AXUIElement, _ name: String) -> String? {
    if let value = attr(element, name) as? String { return value }
    if let value = attr(element, name) as? NSString { return value as String }
    return nil
}

func boolAttr(_ element: AXUIElement, _ name: String) -> Bool? {
    if let value = attr(element, name) as? Bool { return value }
    if let value = attr(element, name) as? NSNumber { return value.boolValue }
    return nil
}

func cgRectAttr(_ element: AXUIElement, _ name: String) -> CGRect? {
    guard let value = attr(element, name) else { return nil }
    guard CFGetTypeID(value) == AXValueGetTypeID() else { return nil }
    let axValue = unsafeBitCast(value, to: AXValue.self)
    guard AXValueGetType(axValue) == .cgRect else { return nil }
    var rect = CGRect.zero
    if AXValueGetValue(axValue, .cgRect, &rect) {
        return rect
    }
    return nil
}

func children(_ element: AXUIElement) -> [AXUIElement] {
    arrayAttr(element, kAXChildrenAttribute as String)
}

func role(_ element: AXUIElement) -> String {
    stringAttr(element, kAXRoleAttribute as String) ?? ""
}

func center(of rect: CGRect) -> CGPoint {
    CGPoint(x: rect.origin.x + rect.size.width / 2, y: rect.origin.y + rect.size.height / 2)
}

func sleepSeconds(_ seconds: Double) {
    Thread.sleep(forTimeInterval: seconds)
}

func activate(_ app: NSRunningApplication) {
    app.activate(options: [.activateAllWindows])
    sleepSeconds(0.35)
}

func postKey(_ keyCode: CGKeyCode, flags: CGEventFlags = []) {
    guard let source = CGEventSource(stateID: .hidSystemState) else { return }
    let down = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: true)
    let up = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: false)
    down?.flags = flags
    up?.flags = flags
    down?.post(tap: .cghidEventTap)
    up?.post(tap: .cghidEventTap)
}

func postMouseClick(at point: CGPoint) {
    guard let source = CGEventSource(stateID: .hidSystemState) else { return }
    let move = CGEvent(mouseEventSource: source, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left)
    let down = CGEvent(mouseEventSource: source, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left)
    let up = CGEvent(mouseEventSource: source, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left)
    move?.post(tap: .cghidEventTap)
    sleepSeconds(0.03)
    down?.post(tap: .cghidEventTap)
    sleepSeconds(0.03)
    up?.post(tap: .cghidEventTap)
}

func setFocused(_ element: AXUIElement) {
    _ = AXUIElementSetAttributeValue(element, kAXFocusedAttribute as CFString, kCFBooleanTrue)
}

func setStringValue(_ element: AXUIElement, _ value: String) {
    _ = AXUIElementSetAttributeValue(element, kAXValueAttribute as CFString, value as CFTypeRef)
}

func visibleRows(in list: AXUIElement) -> [AXUIElement] {
    let listFrame = cgRectAttr(list, "AXFrame") ?? .null
    let rows = arrayAttr(list, kAXRowsAttribute as String)
    return rows.filter { row in
        guard let frame = cgRectAttr(row, "AXFrame"), !frame.isNull else { return false }
        guard frame.height > 1 else { return false }
        if listFrame.isNull {
            return true
        }
        return frame.intersects(listFrame)
    }
}

func preserveClipboard<T>(_ block: () throws -> T) throws -> T {
    let pasteboard = NSPasteboard.general
    let backup = pasteboard.string(forType: .string)
    defer {
        pasteboard.clearContents()
        if let backup {
            pasteboard.setString(backup, forType: .string)
        }
    }
    return try block()
}

func copyTranscriptText(context: UIContext) throws -> String {
    activate(context.app)
    if let frame = cgRectAttr(context.transcriptList, "AXFrame") {
        postMouseClick(at: center(of: frame))
        sleepSeconds(0.12)
    } else {
        setFocused(context.transcriptList)
        sleepSeconds(0.12)
    }
    return try preserveClipboard {
        postKey(0, flags: .maskCommand)
        sleepSeconds(0.1)
        postKey(8, flags: .maskCommand)
        sleepSeconds(0.18)
        return NSPasteboard.general.string(forType: .string) ?? ""
    }
}

func screenshot(path: String?) throws {
    guard let path, !path.isEmpty else { return }
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
    process.arguments = ["-x", path]
    try process.run()
    process.waitUntilExit()
    if process.terminationStatus != 0 {
        throw BridgeError.screenshotFailed(path)
    }
}

func normalizedTitleToken(_ value: String) -> String {
    let folded = value
        .folding(options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive], locale: .current)
        .replacingOccurrences(of: "\r", with: "")
        .replacingOccurrences(of: "\n", with: "")
        .trimmingCharacters(in: .whitespacesAndNewlines)
    let scalars = folded.decomposedStringWithCanonicalMapping.unicodeScalars.filter { scalar in
        !CharacterSet.nonBaseCharacters.contains(scalar) && CharacterSet.alphanumerics.contains(scalar)
    }
    return String(String.UnicodeScalarView(scalars))
}

func boundsFromWindowInfo(_ info: [String: Any]) -> CGRect? {
    guard let bounds = info[kCGWindowBounds as String] as? [String: Any] else { return nil }
    guard
        let x = bounds["X"] as? Double,
        let y = bounds["Y"] as? Double,
        let width = bounds["Width"] as? Double,
        let height = bounds["Height"] as? Double
    else {
        return nil
    }
    return CGRect(x: x, y: y, width: width, height: height)
}

func resolveWindowNumber(context: UIContext) -> CGWindowID? {
    let windowInfos = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] ?? []
    let expectedFrame = context.windowFrame ?? .null
    var bestMatch: (id: CGWindowID, distance: CGFloat)?
    for info in windowInfos {
        guard (info[kCGWindowOwnerName as String] as? String) == "LINE" else { continue }
        guard let windowNumber = (info[kCGWindowNumber as String] as? NSNumber)?.uint32Value else { continue }
        guard let bounds = boundsFromWindowInfo(info) else { continue }
        let distance: CGFloat
        if expectedFrame.isNull {
            distance = bounds.width * bounds.height
        } else {
            distance = abs(bounds.origin.x - expectedFrame.origin.x)
                + abs(bounds.origin.y - expectedFrame.origin.y)
                + abs(bounds.size.width - expectedFrame.size.width)
                + abs(bounds.size.height - expectedFrame.size.height)
        }
        if bestMatch == nil || distance < bestMatch!.distance {
            bestMatch = (windowNumber, distance)
        }
    }
    return bestMatch?.id
}

func captureWindowImage(context: UIContext) -> CGImage? {
    guard let windowNumber = resolveWindowNumber(context: context) else { return nil }
    return CGWindowListCreateImage(.null, .optionIncludingWindow, windowNumber, [.bestResolution])
}

func recognizeTextLines(in image: CGImage) -> [String] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.recognitionLanguages = ["ja-JP", "en-US"]
    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    do {
        try handler.perform([request])
    } catch {
        return []
    }
    return (request.results ?? []).compactMap { observation in
        observation.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines)
    }.filter { !$0.isEmpty }
}

func headerTextObserved(context: UIContext) -> [String] {
    guard let image = captureWindowImage(context: context) else { return [] }
    let width = CGFloat(image.width)
    let height = CGFloat(image.height)
    let cropRect = CGRect(
        x: max(0, width * 0.22),
        y: 0,
        width: max(240, width * 0.56),
        height: min(max(120, height * 0.11), 180)
    ).integral
    guard let cropped = image.cropping(to: cropRect) else { return [] }
    return recognizeTextLines(in: cropped)
}

func headerMatchesExpected(_ observed: [String], expectedTitle: String) -> Bool {
    let expected = normalizedTitleToken(expectedTitle)
    guard !expected.isEmpty else { return false }
    return observed.contains { line in
        let normalized = normalizedTitleToken(line)
        return !normalized.isEmpty && normalized.contains(expected)
    }
}

func isLoggedOutSessionWindow(_ window: AXUIElement) -> Bool {
    let topChildren = children(window)
    let textFields = topChildren.filter { role($0) == "AXTextField" }
    let buttons = topChildren.filter { role($0) == "AXButton" }
    let splitGroups = topChildren.filter { role($0) == "AXSplitGroup" }
    if !splitGroups.isEmpty {
        return false
    }
    return textFields.count >= 2 && buttons.count >= 2
}

func hasChatSplitWindow(_ window: AXUIElement) -> Bool {
    children(window).contains { role($0) == "AXSplitGroup" }
}

func windowArea(_ window: AXUIElement) -> CGFloat {
    guard let frame = cgRectAttr(window, "AXFrame"), !frame.isNull else { return 0 }
    return max(frame.width * frame.height, 0)
}

func selectRelevantWindow(_ appEl: AXUIElement) -> AXUIElement? {
    let windows = arrayAttr(appEl, kAXWindowsAttribute as String)
    guard !windows.isEmpty else { return nil }
    return windows.sorted { lhs, rhs in
        let lhsRank = hasChatSplitWindow(lhs) ? 0 : (isLoggedOutSessionWindow(lhs) ? 1 : 2)
        let rhsRank = hasChatSplitWindow(rhs) ? 0 : (isLoggedOutSessionWindow(rhs) ? 1 : 2)
        if lhsRank != rhsRank {
            return lhsRank < rhsRank
        }
        return windowArea(lhs) > windowArea(rhs)
    }.first
}

func resolveContext() throws -> UIContext {
    guard AXIsProcessTrusted() else {
        throw BridgeError.contextNotFound("accessibility_not_trusted")
    }
    guard let app = NSWorkspace.shared.runningApplications.first(where: { $0.localizedName == "LINE" }) else {
        throw BridgeError.lineNotRunning
    }
    activate(app)
    let appEl = AXUIElementCreateApplication(app.processIdentifier)
    guard let window = selectRelevantWindow(appEl) else {
        throw BridgeError.windowNotFound
    }
    let windowTitle = stringAttr(window, kAXTitleAttribute as String) ?? "LINE"
    let windowFrame = cgRectAttr(window, "AXFrame")
    let topChildren = children(window)
    if isLoggedOutSessionWindow(window) {
        throw BridgeError.contextNotFound("session_logged_out")
    }
    guard let rootSplit = topChildren.first(where: { role($0) == "AXSplitGroup" }) else {
        throw BridgeError.contextNotFound("root_split_missing")
    }
    let rootChildren = children(rootSplit)
    guard let mainSplit = rootChildren.first(where: { role($0) == "AXSplitGroup" }) else {
        throw BridgeError.contextNotFound("main_split_missing")
    }
    guard let searchField = rootChildren.first(where: { role($0) == "AXTextField" }) else {
        throw BridgeError.contextNotFound("search_field_missing")
    }
    let rootLists = rootChildren.filter { role($0) == "AXList" }
    guard let sidebarList = rootLists.min(by: {
        let lhs = cgRectAttr($0, "AXFrame")?.width ?? .greatestFiniteMagnitude
        let rhs = cgRectAttr($1, "AXFrame")?.width ?? .greatestFiniteMagnitude
        return lhs < rhs
    }) else {
        throw BridgeError.contextNotFound("sidebar_list_missing")
    }
    let mainChildren = children(mainSplit)
    guard let transcriptList = mainChildren.first(where: { role($0) == "AXList" }) else {
        throw BridgeError.contextNotFound("transcript_list_missing")
    }
    guard let composerField = mainChildren.first(where: { role($0) == "AXTextArea" }) else {
        throw BridgeError.contextNotFound("composer_missing")
    }
    return UIContext(
        app: app,
        window: window,
        windowTitle: windowTitle,
        windowFrame: windowFrame,
        rootSplit: rootSplit,
        mainSplit: mainSplit,
        sidebarList: sidebarList,
        transcriptList: transcriptList,
        searchField: searchField,
        composerField: composerField
    )
}

func selectTarget(context: UIContext, titleContains: String?) throws -> (attempted: Bool, matched: Bool, sidebarRows: Int, appliedQuery: Bool, selectedRowIndex: Int?, headerTextObserved: [String]) {
    guard let titleContains, !titleContains.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        return (false, true, visibleRows(in: context.sidebarList).count, false, nil, headerTextObserved(context: context))
    }
    activate(context.app)
    setFocused(context.searchField)
    setStringValue(context.searchField, titleContains)
    sleepSeconds(0.45)
    let rows = visibleRows(in: context.sidebarList)
    guard !rows.isEmpty else {
        return (true, false, 0, true, nil, [])
    }
    var lastObserved: [String] = []
    for (index, row) in rows.enumerated() {
        guard let frame = cgRectAttr(row, "AXFrame"), !frame.isNull else { continue }
        postMouseClick(at: center(of: frame))
        sleepSeconds(0.45)
        let header = headerTextObserved(context: context)
        lastObserved = header
        if headerMatchesExpected(header, expectedTitle: titleContains) {
            return (true, true, rows.count, true, index, header)
        }
    }
    return (true, false, rows.count, true, nil, lastObserved)
}

func sendThroughComposer(context: UIContext, text: String) {
    activate(context.app)
    if let frame = cgRectAttr(context.composerField, "AXFrame") {
        postMouseClick(at: center(of: frame))
        sleepSeconds(0.08)
    }
    setFocused(context.composerField)
    setStringValue(context.composerField, text)
    sleepSeconds(0.08)
    postKey(36)
}

func waitForTranscriptChange(context: UIContext, baseline: String, timeout: Int, pollSeconds: Int) throws -> String {
    let deadline = Date().addingTimeInterval(Double(max(timeout, 1)))
    let poll = max(Double(pollSeconds), 1)
    var last = baseline
    while Date() < deadline {
        sleepSeconds(poll)
        let current = try copyTranscriptText(context: context)
        if current != baseline {
            return current
        }
        last = current
    }
    return last
}

func runConversationLoop(payload: Payload) throws -> LoopResult {
    let context = try resolveContext()
    let titleContains = payload.expectedChatTitle?.trimmingCharacters(in: .whitespacesAndNewlines)
    let selection = try selectTarget(context: context, titleContains: titleContains)
    let beforeTranscript = try copyTranscriptText(context: context)
    try screenshot(path: payload.screenshotBeforePath)

    let mode = (payload.sendMode ?? "execute").trimmingCharacters(in: .whitespacesAndNewlines)
    if mode == "dry_run" {
        try screenshot(path: payload.screenshotAfterPath)
        return LoopResult(
            ok: selection.matched,
            transport: "line_desktop_user_account",
            expectedChatTitle: titleContains,
            targetSelectionAttempted: selection.attempted,
            targetMatchedHeuristic: selection.matched,
            searchQueryApplied: selection.appliedQuery,
            sidebarVisibleRows: selection.sidebarRows,
            selectedRowIndex: selection.selectedRowIndex,
            headerTextObserved: selection.headerTextObserved,
            windowTitle: context.windowTitle,
            windowFrame: context.windowFrame.map { WindowFrame(x: $0.origin.x, y: $0.origin.y, width: $0.size.width, height: $0.size.height) },
            transcriptBefore: beforeTranscript,
            transcriptAfterSend: beforeTranscript,
            transcriptAfterReply: beforeTranscript,
            replyObserved: false,
            screenshotBeforePath: payload.screenshotBeforePath,
            screenshotAfterPath: payload.screenshotAfterPath,
            error: selection.matched ? nil : "target_selection_failed"
        )
    }

    let text = (payload.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    sendThroughComposer(context: context, text: text)
    sleepSeconds(0.6)
    let afterSend = try waitForTranscriptChange(
        context: context,
        baseline: beforeTranscript,
        timeout: min(max(payload.observeSeconds ?? 12, 4), 20),
        pollSeconds: 1
    )

    let replyObserve = max(payload.observeSeconds ?? 18, 1)
    let pollSeconds = max(payload.pollSeconds ?? 2, 1)
    let afterReply = try waitForTranscriptChange(
        context: context,
        baseline: afterSend,
        timeout: replyObserve,
        pollSeconds: pollSeconds
    )
    let replyObserved = afterReply != afterSend
    try screenshot(path: payload.screenshotAfterPath)

    return LoopResult(
        ok: selection.matched,
        transport: "line_desktop_user_account",
        expectedChatTitle: titleContains,
        targetSelectionAttempted: selection.attempted,
        targetMatchedHeuristic: selection.matched,
        searchQueryApplied: selection.appliedQuery,
        sidebarVisibleRows: selection.sidebarRows,
        selectedRowIndex: selection.selectedRowIndex,
        headerTextObserved: selection.headerTextObserved,
        windowTitle: context.windowTitle,
        windowFrame: context.windowFrame.map { WindowFrame(x: $0.origin.x, y: $0.origin.y, width: $0.size.width, height: $0.size.height) },
        transcriptBefore: beforeTranscript,
        transcriptAfterSend: afterSend,
        transcriptAfterReply: afterReply,
        replyObserved: replyObserved,
        screenshotBeforePath: payload.screenshotBeforePath,
        screenshotAfterPath: payload.screenshotAfterPath,
        error: selection.matched ? nil : "target_selection_failed"
    )
}

func runSnapshot(payload: Payload) throws -> LoopResult {
    let context = try resolveContext()
    let titleContains = payload.expectedChatTitle?.trimmingCharacters(in: .whitespacesAndNewlines)
    let selection = try selectTarget(context: context, titleContains: titleContains)
    let transcript = try copyTranscriptText(context: context)
    try screenshot(path: payload.screenshotBeforePath)
    return LoopResult(
        ok: selection.matched,
        transport: "line_desktop_user_account",
        expectedChatTitle: titleContains,
        targetSelectionAttempted: selection.attempted,
        targetMatchedHeuristic: selection.matched,
        searchQueryApplied: selection.appliedQuery,
        sidebarVisibleRows: selection.sidebarRows,
        selectedRowIndex: selection.selectedRowIndex,
        headerTextObserved: selection.headerTextObserved,
        windowTitle: context.windowTitle,
        windowFrame: context.windowFrame.map { WindowFrame(x: $0.origin.x, y: $0.origin.y, width: $0.size.width, height: $0.size.height) },
        transcriptBefore: transcript,
        transcriptAfterSend: transcript,
        transcriptAfterReply: transcript,
        replyObserved: false,
        screenshotBeforePath: payload.screenshotBeforePath,
        screenshotAfterPath: nil,
        error: selection.matched ? nil : "target_selection_failed"
    )
}

func runReadiness(payload: Payload) -> ReadinessResult {
    let expectedTitle = payload.expectedChatTitle?.trimmingCharacters(in: .whitespacesAndNewlines)
    guard AXIsProcessTrusted() else {
        return ReadinessResult(
            ok: true,
            ready: false,
            transport: "line_desktop_user_account",
            accessibilityTrusted: false,
            lineRunning: false,
            contextResolved: false,
            expectedChatTitle: expectedTitle,
            expectedTitleMatched: nil,
            targetSelectionAttempted: nil,
            targetMatchedHeuristic: nil,
            searchQueryApplied: nil,
            sidebarVisibleRows: nil,
            headerTextObserved: [],
            windowTitle: nil,
            windowFrame: nil,
            selectedRowIndex: nil,
            error: "accessibility_not_trusted"
        )
    }
    guard NSWorkspace.shared.runningApplications.first(where: { $0.localizedName == "LINE" }) != nil else {
        return ReadinessResult(
            ok: true,
            ready: false,
            transport: "line_desktop_user_account",
            accessibilityTrusted: true,
            lineRunning: false,
            contextResolved: false,
            expectedChatTitle: expectedTitle,
            expectedTitleMatched: nil,
            targetSelectionAttempted: nil,
            targetMatchedHeuristic: nil,
            searchQueryApplied: nil,
            sidebarVisibleRows: nil,
            headerTextObserved: [],
            windowTitle: nil,
            windowFrame: nil,
            selectedRowIndex: nil,
            error: "line_not_running"
        )
    }
    do {
        let context = try resolveContext()
        let header = headerTextObserved(context: context)
        var readinessHeader = header
        var matched = expectedTitle.map { headerMatchesExpected(header, expectedTitle: $0) }
        var selectionEvidence: (attempted: Bool, matched: Bool, sidebarRows: Int, appliedQuery: Bool, selectedRowIndex: Int?, headerTextObserved: [String])? = nil
        if matched == false, let expectedTitle, !expectedTitle.isEmpty {
            let selection = try selectTarget(context: context, titleContains: expectedTitle)
            selectionEvidence = selection
            readinessHeader = selection.headerTextObserved
            matched = selection.matched
        }
        return ReadinessResult(
            ok: true,
            ready: matched ?? true,
            transport: "line_desktop_user_account",
            accessibilityTrusted: true,
            lineRunning: true,
            contextResolved: true,
            expectedChatTitle: expectedTitle,
            expectedTitleMatched: matched,
            targetSelectionAttempted: selectionEvidence?.attempted,
            targetMatchedHeuristic: selectionEvidence?.matched,
            searchQueryApplied: selectionEvidence?.appliedQuery,
            sidebarVisibleRows: selectionEvidence?.sidebarRows,
            headerTextObserved: readinessHeader,
            windowTitle: context.windowTitle,
            windowFrame: context.windowFrame.map { WindowFrame(x: $0.origin.x, y: $0.origin.y, width: $0.size.width, height: $0.size.height) },
            selectedRowIndex: selectionEvidence?.selectedRowIndex,
            error: matched == false ? "expected_title_not_visible" : nil
        )
    } catch {
        return ReadinessResult(
            ok: true,
            ready: false,
            transport: "line_desktop_user_account",
            accessibilityTrusted: true,
            lineRunning: true,
            contextResolved: false,
            expectedChatTitle: expectedTitle,
            expectedTitleMatched: nil,
            targetSelectionAttempted: nil,
            targetMatchedHeuristic: nil,
            searchQueryApplied: nil,
            sidebarVisibleRows: nil,
            headerTextObserved: [],
            windowTitle: nil,
            windowFrame: nil,
            selectedRowIndex: nil,
            error: String(describing: error)
        )
    }
}

let command = CommandLine.arguments.dropFirst().first ?? "conversation-loop"
let inputData = FileHandle.standardInput.readDataToEndOfFile()
let payload = try JSONDecoder().decode(Payload.self, from: inputData.isEmpty ? Data("{}".utf8) : inputData)
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
let output: Data

switch command {
case "conversation-loop":
    output = try encoder.encode(runConversationLoop(payload: payload))
case "snapshot":
    output = try encoder.encode(runSnapshot(payload: payload))
case "readiness":
    output = try encoder.encode(runReadiness(payload: payload))
default:
    throw BridgeError.unsupportedCommand(command)
}
FileHandle.standardOutput.write(output)
FileHandle.standardOutput.write(Data("\n".utf8))
