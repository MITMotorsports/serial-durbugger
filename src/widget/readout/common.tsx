import {SetBehavior, WidgetBehavior} from "../widget.ts";
import React, {useCallback, useEffect, useRef, useState} from "react";
import Button from "../../component/button.tsx";
import {useAlerts} from "../../alert.tsx";
import {Project} from "../../device.tsx";
import {Autocomplete} from "../../component/autocomplete.tsx";

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
    fullString: string
): ReadoutParseResult {
    const readouts: Readout[] = [];
    let lastMatchEnd = 0;

    // We must use the 'g' (global) flag on the regex for repeated matching
    // and use fullString.matchAll() to iterate over all matches.
    const matches = fullString.matchAll(READOUT_REGEX);

    for (const match of matches) {
        const component = match[1];
        const valueStr = match[2];

        readouts.push({
            component: component,
            // The regex ensures valueStr is a valid number string
            value: Number.parseFloat(valueStr),
        });

        lastMatchEnd = match.index! + match[0].length;
    }

    return {values: readouts, lastMatchEnd};
}

export function parseKnownReadouts(
    fullString: string,
    validComponents: string[]
): ReadoutParseResult {
    let result = parseReadouts(fullString);

    return {
        lastMatchEnd:result.lastMatchEnd,
        values: result.values.filter((it) => validComponents.includes(it.component))
    }
}

export const ReadoutConfiguration: React.FC<{
    behavior: WidgetBehavior<"readout"> | null,
    setBehavior: SetBehavior<"readout">,
    project: Project
}> = ({behavior, setBehavior, project}) => {
    const rawBuffer = useRef<string>("")
    const [collectedComponents, setCollectedComponents] = useState<string[]>([]);

    const [newComponent, setNewComponent] = useState<string>('');
    const alerts = useAlerts()

    const handleReceive = (buf: Uint8Array) => {
        const decoded = new TextDecoder().decode(buf);
        const full = rawBuffer.current + decoded;

        const result = parseReadouts(full);

        setCollectedComponents((prev) => {
            const maybeNew = result.values.map((it) => it.component)

            for (let component of maybeNew) {
                if (!prev.includes(component)) {
                    return [...new Set([...maybeNew, ...prev])]
                }
            }

            return prev
        })

        rawBuffer.current = full.substring(result.lastMatchEnd);
    }

    useEffect(() => {
        const raw = project.registerListener.raw((buf) => {
            handleReceive(buf);
        });

        return () => {
            project.unregisterListener.raw(raw)
        }
    }, [project, handleReceive]);

    // Function to add a component, memoized with useCallback
    const handleAddComponent = useCallback(() => {
        const trimmedComponent = newComponent.trim();
        if (trimmedComponent) {
            // Check for duplicates before adding
            if (!behavior?.components?.includes(trimmedComponent)) {
                setBehavior({
                    components: [...(behavior?.components ?? []), trimmedComponent],
                })
                setNewComponent(''); // Clear the input field
            } else {
                alerts.showAlert("warning", `The component ${trimmedComponent} is already added`);
            }
        }
    }, [behavior, newComponent]);

    const handleRemoveComponent = useCallback((componentToRemove: string) => {
        setBehavior({
            components: behavior?.components?.filter(c => c !== componentToRemove) ?? [],
        })
    }, [behavior]);

    // Handler for the 'Enter' key press on the input
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleAddComponent();
        }
    };

    return (
        <div className={"w-3/4"}>
            <h2 className="text-center my-4 text-xl font-semibold">Readout Components</h2>
            <h3 className="text-center m-3 text-lg font-light">Components</h3>

            <div className={"justify-center flex gap-5 ml-auto"}>
                <Autocomplete
                    value={newComponent}
                    onChange={(e) => {
                        setNewComponent(e);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter Component"
                    knownValues={collectedComponents}
                />
                <Button
                    onClick={handleAddComponent}
                    disabled={!newComponent.trim()}
                >Add component</Button>
            </div>

            <div style={{marginTop: '20px'}}>
                {behavior?.components?.length === 0 ? (
                    <p style={{color: '#666'}}></p>
                ) : (
                    // Display list with flex or a list style for better formatting
                    <ul style={{listStyleType: 'none', padding: 0}}>
                        {(behavior?.components ?? []).map((component) => (
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
                                    onClick={() => handleRemoveComponent(component)}
                                    className={"p-1 border-none ml-2 rounded cursor-pointer hover:bg-red-200 transition-colors duration-200"}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none"
                                         viewBox="0 0 24 24"
                                         stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                              d="M6 18L18 6M6 6l12 12"/>
                                    </svg>
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}