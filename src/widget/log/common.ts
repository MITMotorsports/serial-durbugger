
export type LogEntry = {
    level: string;
    timestamp: number;
    file: string;
    line: string; // Stored as string to handle formats like '9.9'
    message: string;
    originalLine: string;
}

const LOG_REGEX = /\[(\w+)\s+Time:\s*(\d+)\s+File:\s*(\S+)\s+Line:\s*([\d.\s]+?)\s*\]\s*(.*)/;

export type LogParseResult = {
    logs: LogEntry[],
    lastIndex: number,
}

export function parseLogContent(content: string): LogParseResult {
    const result : LogEntry[] = [];
    let endIndex = 0;

    for (let line of content.split('\n')) {
        LOG_REGEX.lastIndex = 0
        const match = LOG_REGEX.exec(line);

        if (!match) continue

        endIndex = (match.index ?? 0) + match[0].length;

        // Destructure the capture groups from the regex match
        const [, level, timestampStr, file, rawLineNum, message] = match;

        // Clean up the captured line number (e.g., " 9. 9 " -> "9.9")
        const cleanedLineNum = rawLineNum.replace(/\s+/g, '').trim();

        result.push({
            level: level.toUpperCase(),
            timestamp: parseInt(timestampStr, 10),
            file: file,
            line: cleanedLineNum,
            message: message.trim(),
            originalLine: line,
        })
    }

    return {
        logs: result,
        lastIndex: endIndex,
    }
}