import React, { useState, useEffect, useMemo } from "react";

/**
 * Escapes special regex characters in a string.
 * @param str The string to escape.
 */
function escapeRegExp(str: string) {
    // $& means the whole matched string
    return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export type TextSelection = {
    /** The line index (0-based) */
    line: number,
    /** The character index (0-based) of the match's start on that line */
    startIndex: number,
    endIndex: number,
}

/**
 * Props for the FindTool component.
 */
export interface FindToolProps {
    /**
     * The content to search, as an array of strings.
     */
    content: string[];
    /**
     * Callback fired when the user navigates to a match.
     * The parent component should scroll to the provided line and character index.
     * @param selection The active selection, or null if no match.
     */
    onFind: (selection: TextSelection | null) => void;
}

/**
 * A reusable search bar component.
 * It finds all matches in the provided `content` (including multiple
 * matches per line) and handles its own keyboard navigation.
 *
 * The parent component is responsible for:
 * 1. Passing in the `content` to search.
 * 2. Implementing the `onFind` callback (to scroll to the line/character).
 */
export default function FindTool({
                                     content,
                                     onFind,
                                 }: FindToolProps) {

    // Internal state for visibility, query, and match index
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

    // Memoize search results for performance
    const searchResults = useMemo(() => {
        if (!query) return [];

        const results: TextSelection[] = [];
        const escapedQuery = escapeRegExp(query);
        const regex = new RegExp(escapedQuery, 'gi');

        content.forEach((line, lineIndex) => {
            let match;
            // Find all matches in the current line
            while ((match = regex.exec(line)) !== null) {
                results.push({
                    line: lineIndex,
                    startIndex: match.index, // Store the character index of the match
                    endIndex: match.index + match[0].length,
                });
            }
        });
        return results;
    }, [query, content]);

    const matchCount = searchResults.length;

    // Effect to reset current index if search results change
    useEffect(() => {
        // if (query) {
        //     setCurrentMatchIndex(matchCount > 0 ? 0 : -1);
        // } else {
        //     setCurrentMatchIndex(-1);
        // }
    }, [query, matchCount]);

    // Effect to call onFind whenever the currentMatchIndex or query changes
    useEffect(() => {
        if (currentMatchIndex >= 0 && currentMatchIndex < matchCount) {
            const selection = searchResults[currentMatchIndex];
            onFind(selection);
        } else {
            onFind(null);
        }
    }, [query, currentMatchIndex]);

    // Effect to listen for global keydown events (Ctrl+F and Esc)
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Ctrl+F or Cmd+F to open
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                setIsOpen(!isOpen);
            }
            // Escape to close
            if (e.key === 'Escape') {
                if (isOpen) {
                    e.preventDefault();
                    setIsOpen(false);
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
        };
    }, [isOpen]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        // We no longer need to call onFind(null) here;
        // The useEffect hooks will handle it.
    };

    const handleNextMatch = () => {
        if (matchCount === 0) return;
        const nextIndex = (currentMatchIndex + 1) % matchCount;
        setCurrentMatchIndex(nextIndex);
    };

    const handlePrevMatch = () => {
        if (matchCount === 0) return;
        const prevIndex = (currentMatchIndex - 1 + matchCount) % matchCount;
        setCurrentMatchIndex(prevIndex);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                handlePrevMatch();
            } else {
                handleNextMatch();
            }
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="absolute top-0 right-0 z-50 m-2 p-2 bg-white shadow-lg rounded-lg border border-gray-200 flex items-center space-x-2">
            <div className="flex items-center space-x-2">
                <input
                    type="text"
                    value={query}
                    onChange={handleSearchChange}
                    onKeyDown={handleKeyDown}
                    className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Search..."
                    autoFocus
                />
                <span className="text-sm text-gray-500 w-16 text-center">
          {matchCount > 0 ? `${currentMatchIndex + 1} of ${matchCount}` : "0/0"}
        </span>
                <button
                    type="button"
                    onClick={handlePrevMatch}
                    disabled={matchCount === 0}
                    className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-50"
                    title="Previous (Shift+Enter)"
                >
                    {/* Chevron Up */}
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                    </svg>
                </button>
                <button
                    type="button"
                    onClick={handleNextMatch}
                    disabled={matchCount === 0}
                    className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-50"
                    title="Next (Enter)"
                >
                    {/* Chevron Down */}
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                </button>
            </div>
            <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md hover:bg-gray-100"
                title="Close (Esc)"
            >
                {/* Close (X) */}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}