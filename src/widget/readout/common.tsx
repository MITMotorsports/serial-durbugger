import {SetBehavior} from "../tool.ts";
import Input from "../../component/input.tsx";
import React, {useCallback, useEffect, useState} from "react";
import Button from "../../component/button.tsx";
import {useAlerts} from "../../alert.tsx";

export const READOUT_REGEX = /(\w+)\$=(\d+\.?\d*)/g;

// Assuming SetBehavior is a type like (newBehavior: { components: string[] }) => void
// and Input, Button are functional components that accept standard props
// For this example, I'll use simple HTML for Input and Button as placeholders
// but you can replace them with your actual components.

/**
 * The result of the parsing operation.
 */
interface ReadoutParseResult {
    values: {
        component: string;
        value: number;
    }[];
    lastMatchEnd: number;
}

/**
 * Helper to check if a char code is part of a "word" (\w).
 * This is much faster than a regex check.
 */
function isWordCharCode(code: number): boolean {
    return (
        (code >= 48 && code <= 57) || // 0-9
        (code >= 65 && code <= 90) || // A-Z
        (code >= 97 && code <= 122) || // a-z
        code === 95 // _
    );
}

/**
 * Parses a string for "component$=value" readouts without using regex.
 *
 * @param fullString The complete string to parse.
 * @param validComponents An array of component names to look for.
 * @returns A ReadoutParseResult object with the found readouts and the end index.
 */
export function parseReadouts(
    fullString: string,
    validComponents: string[]
): ReadoutParseResult {
    const readouts: {
        component: string;
        value: number;
    }[] = [];
    let lastMatchEnd = 0;
    let searchIndex = 0;

    while (true) {
        // Find the start of our key-value marker
        const markerIndex = fullString.indexOf('$=', searchIndex);
        if (markerIndex === -1) {
            break; // No more matches found
        }

        // --- 1. Find the Key (Component) ---
        // Search backwards from the marker
        let keyStartIndex = markerIndex - 1;
        while (keyStartIndex >= 0 && isWordCharCode(fullString.charCodeAt(keyStartIndex))) {
            keyStartIndex--;
        }
        keyStartIndex++; // We went one char too far, so step back

        const component = fullString.substring(keyStartIndex, markerIndex);

        // --- 2. Find the Value ---
        // Search forwards from the marker
        let valueStartIndex = markerIndex + 2; // Skip '$='
        let valueEndIndex = valueStartIndex;

        // The original regex `\d+\.?\d*` requires at least one digit to start
        if (valueEndIndex >= fullString.length || fullString.charCodeAt(valueEndIndex) < 48 || fullString.charCodeAt(valueEndIndex) > 57) {
            // Does not start with a digit, not a valid match.
            searchIndex = valueStartIndex; // Start next search after the '!='
            continue;
        }

        // Consume all digits for the integer part (\d+)
        while (valueEndIndex < fullString.length && fullString.charCodeAt(valueEndIndex) >= 48 && fullString.charCodeAt(valueEndIndex) <= 57) {
            valueEndIndex++;
        }

        // Check for an optional decimal point (\.?)
        let hasDecimal = false;
        if (valueEndIndex < fullString.length && fullString.charCodeAt(valueEndIndex) === 46 /* . */) {
            hasDecimal = true;
            valueEndIndex++; // Consume the decimal
        }

        // If we had a decimal, consume the optional following digits (\d*)
        if (hasDecimal) {
            while (valueEndIndex < fullString.length && fullString.charCodeAt(valueEndIndex) >= 48 && fullString.charCodeAt(valueEndIndex) <= 57) {
                valueEndIndex++;
            }
        }

        const valueStr = fullString.substring(valueStartIndex, valueEndIndex);

        // --- 3. Process the Match ---
        if (validComponents.includes(component)) {
            readouts.push({
                component: component,
                value: Number.parseFloat(valueStr), // Our parser ensures this is a valid number string
            });
            // Update the index of the *last valid* match
            lastMatchEnd = valueEndIndex;
        }

        // Continue searching from the end of this value
        searchIndex = valueEndIndex;
    }

    return { values: readouts, lastMatchEnd };
}

export const ReadoutConfiguration: React.FC<{ setBehavior: SetBehavior }> = ({setBehavior}) => {
    const [components, setComponents] = useState<string[]>([]);
    const [newComponent, setNewComponent] = useState<string>('');
    const alerts = useAlerts()

    // Function to add a component, memoized with useCallback
    const handleAddComponent = useCallback(() => {
        const trimmedComponent = newComponent.trim();
        if (trimmedComponent) {
            // Check for duplicates before adding
            if (!components.includes(trimmedComponent)) {
                setComponents(prev => [...prev, trimmedComponent]);
                setNewComponent(''); // Clear the input field
            } else {
                alerts.showAlert("warning", `The component ${trimmedComponent} is already added`);
            }
        }
    }, [newComponent, components]);

    const handleRemoveComponent = useCallback((componentToRemove: string) => {
        setComponents(prev => prev.filter(c => c !== componentToRemove));
    }, []);

    // Effect to notify the parent when the components list changes
    useEffect(() => {
        setBehavior({ components });
    }, [components, setBehavior]);

    // Handler for the 'Enter' key press on the input
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleAddComponent();
        }
    };

    return (
        <div>
            <h1>Readout Components</h1>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Input
                    value={newComponent}
                    onChange={(e) => setNewComponent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter component ID..."
                />
                <Button
                    onClick={handleAddComponent}
                    disabled={!newComponent.trim()}
                >
                    Add Component
                </Button>
            </div>

            <div style={{ marginTop: '20px' }}>
                {components.length === 0 ? (
                    <p style={{ color: '#666' }}></p>
                ) : (
                    // Display list with flex or a list style for better formatting
                    <ul style={{ listStyleType: 'none', padding: 0 }}>
                        {components.map((component) => (
                            <li
                                key={component}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px 0',
                                    borderBottom: '1px solid #eee'
                                }}
                            >
                                <span>{component}</span>
                                <Button
                                    // Use a class or a separate styled component for the remove button
                                    onClick={() => handleRemoveComponent(component)}
                                    // Assuming a clean, small remove button style
                                    style={{
                                        padding: '4px 8px',
                                        marginLeft: '10px',
                                        fontSize: '0.8em',
                                        backgroundColor: 'transparent',
                                        color: 'red',
                                        border: '1px solid red',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Remove
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}