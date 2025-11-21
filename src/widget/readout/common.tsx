import {SetBehavior} from "../tool.ts";
import Input from "../../component/input.tsx";
import React, {useCallback, useEffect, useState} from "react";
import Button from "../../component/button.tsx";
import {useAlerts} from "../../alert.tsx";

export const READOUT_REGEX = /(\S+) = (\d+\.?\d*)/g;

/**
 * The result of the parsing operation.
 */
export interface Readout {
    component: string;
    value: number;
}

export interface ReadoutParseResult {
    values: Readout[];
    lastMatchEnd: number;
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
    const readouts: Readout[] = [];
    let lastMatchEnd = 0;

    // We must use the 'g' (global) flag on the regex for repeated matching
    // and use fullString.matchAll() to iterate over all matches.
    const matches = fullString.matchAll(READOUT_REGEX);

    for (const match of matches) {
        const component = match[1];
        const valueStr = match[2];

        console.log(JSON.stringify(component));
        if (validComponents.includes(component)) {
            // match.index is the starting index of the full match (match[0])
            // Since we want the end of the VALUE, we add the length of the full match.

            readouts.push({
                component: component,
                // The regex ensures valueStr is a valid number string
                value: Number.parseFloat(valueStr),
            });
        }

        lastMatchEnd = match.index! + match[0].length;
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