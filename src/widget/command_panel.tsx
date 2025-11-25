import React, {useCallback, useMemo, useRef, useState} from 'react';
import {SetBehavior, ToolContainerProps, WidgetBehavior, WidgetHandler} from "./widget.ts";
import {Project} from "../device.tsx";
import {useAlerts} from "../alert.tsx";
import {Dropdown, DropdownItem, DropdownItemProps} from "../component/dropdown.tsx";

export type CommandType = 'string' | 'number'

export type CommandParameterDefinition = {
    index: number;
    displayName: string;
    type: CommandType;
};

export type CommandDefinition = {
    id: number,
    name: string;
    displayName: string;
    icon: string;
    parameters: CommandParameterDefinition[];
};


export type CommandValue = string | number | null;

// --- Helper Function ---
// Updated: Initializes to 0 or "" since 'default' is removed
const initializeCommandValues = (commands: CommandDefinition[]): Map<number, Map<number, CommandValue>> => {
    const map = new Map<number, Map<number, CommandValue>>()
    commands.forEach(c => {
        const params = new Map<number, CommandValue>()
        // c.parameters.forEach(parameter => {
        //     params.set(parameter.id, null)
        // })
        map.set(c.id, params)
    })
    return map
};

/**
 * Renders the appropriate input for a given command parameter.
 * (No changes from previous version)
 */
const CommandParameterInput: React.FC<{
    parameter: CommandParameterDefinition,
    value: any,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}> = ({parameter, value, onChange}) => {
    const {index, displayName, type} = parameter;

    let inputComponent;
    if (type === 'number') {
        inputComponent = (
            <input
                type="number"
                id={`${index}`}
                value={value}
                onChange={onChange}
                className="flex-grow w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
            />
        );
    } else { // Default to string
        inputComponent = (
            <input
                type="text"
                id={`${index}`}
                value={value}
                onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
            />
        );
    }

    return (
        <div className="mb-4 last:mb-0">
            <label htmlFor={`${index}`} className="block text-sm font-medium text-gray-700 mb-1">
                {displayName}
            </label>
            {inputComponent}
        </div>
    );
};

/**
 * Renders a single command item, which can expand to fill the content area.
 * Updated: Replaced lucide icons with text/character placeholders.
 */
const CommandItem: React.FC<{
    command: CommandDefinition,
    expandedId: number | null,
    onExpand: (id: number) => void,
    onCollapse: () => void,
    onExecute: (id: number) => void,
    values: Map<number, CommandValue>,
    onValueChange: (commandId: number, paramId: number, newValue: CommandValue) => void
}> = ({
          command,
          expandedId,
          onExpand,
          onCollapse,
          onExecute,
          values,
          onValueChange
      }) => {
    const {id, name, icon, parameters} = command;
    const cardRef = useRef<HTMLDivElement>(null);

    const isExpanded = expandedId === id;
    const isAnyExpanded = expandedId !== null;

    // const [originRect, setOriginRect] = useState<BoundingBox | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isExpandedLayout, setIsExpandedLayout] = useState(false);
    const [style, setStyle] = useState({});

    const handleExpandClick = () => {
        onExpand(id);

        // console.log(contentRect.y)
        requestAnimationFrame(() => {
            setIsAnimating(true);
            setIsExpandedLayout(true);
            setStyle({
                width: '100%',
                height: "100%",
                transition: 'all 0.35s ease-in-out',
            });
            setTimeout(() => setIsAnimating(false), 350);
        });
    };

    const handleCollapseClick = () => {
        setIsAnimating(true);
        setIsExpandedLayout(false);
        setStyle({
            // ...originRect,
            position: 'absolute',
            zIndex: 10,
            transition: 'all 0.35s ease-in-out',
        });

        setTimeout(() => {
            setIsAnimating(false);
            onCollapse();
            setStyle({});
        }, 350);
    };

    const handleExecuteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onExecute(id);
    };

    const handleParamChange = (paramIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
        onValueChange(id, paramIndex, newValue);
    };

    const layoutRootClasses = `w-full h-full ${isExpanded ? 'p-4' : ''}`;


    const paramsContainerClasses = `
    transition-opacity duration-300 ease-in-out
    ${isExpandedLayout ? 'opacity-100 delay-200' : 'hidden opacity-0 pointer-events-none'}
    top-16 bottom-24 left-0 right-0 p-4 overflow-y-auto
  `;

    // Use first letter of icon string, or first letter of name, or 'C' as fallback
    const iconLetter = (icon || name || 'C')[0].toUpperCase();

    return (
        <div
            ref={cardRef}
            className={`w-48 h-48
            rounded-lg shadow-md border border-gray-200 flex flex-col p-3.5
            transition-opacity duration-300
            ${isAnyExpanded && !isExpanded ? 'hidden pointer-events-none' : ''}
            ${!isExpanded ? 'cursor-pointer' : 'border-none shadow-none'} transition-all duration-300 ease-in`}
            style={isAnimating || isExpanded ? style : {}}
            onClick={!isExpanded ? handleExpandClick : undefined}
        >
            <div className={layoutRootClasses}>
                {isExpanded && (
                    <button
                        onClick={handleCollapseClick}
                        className="absolute right-0 p-1.5 m-2 text-gray-500 rounded-full hover:bg-gray-100 hover:text-gray-700 focus:outline-none z-20"
                    >
                        {/* Replaced ChevronLeft icon */}
                        <span className="text-xl font-bold">‹</span>
                    </button>
                )}
                <div className={`flex transition-all duration-300 ease-in-out items-center 
                ${isExpandedLayout ? 'flex-row gap-3' : 'relative flex-col justify-center pt-4'}`}
                >
                    <div className={`flex items-center justify-center bg-gray-100 rounded-full
                    ${isExpandedLayout ? 'w-9 h-9 text-lg' : 'w-16 h-16 mb-3'}
                    transition-all duration-300 ease-in-out font-bold text-2xl text-gray-600
                    `}>
                        {/* Replaced getIcon() with text */}
                        {iconLetter}
                    </div>
                    <span className={`font-medium text-gray-800
                    ${isExpandedLayout ? 'text-lg' : 'text-sm text-center'}
                    transition-all duration-300 ease-in-out
                    `}>
                        {name}
                    </span>
                </div>
                <div className={paramsContainerClasses}>
                    <h4 className="text-sm font-semibold text-gray-600 mb-3 uppercase">Parameters</h4>
                    {parameters.length === 0 ? (
                        <p className="text-gray-500">This command has no parameters.</p>
                    ) : (
                        parameters.map(param => {
                            return <CommandParameterInput
                                key={param.index}
                                parameter={param}
                                value={values.get(param.index)}
                                onChange={(e) => handleParamChange(param.index, e)}
                            />
                        })
                    )}
                </div>
                <button
                    onClick={handleExecuteClick}
                    className={`flex items-center justify-center rounded-full bg-green-600 
                    hover:bg-green-700 text-white shadow-sm transition-all duration-300 ease-in-out
                    focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-white
                    ${isExpandedLayout
                        ? 'absolute bottom-0 left-0 right-0 w-auto m-4 py-3 text-lg font-medium'
                        : 'bottom-3 float-right w-9 h-9'}
                        `}
                    aria-label={`Execute ${name}`}
                >
                    {/* Replaced Play icon */}
                    {isExpandedLayout ? <><span className="mr-2">►</span> Execute Command</> : "►"}
                </button>
            </div>
        </div>
    );
};

/**
 * Main Widget Component
 */
const WidgetView: React.FC<{ project: Project, behavior: WidgetBehavior<"commandPanel"> }> = ({
                                                                                                         project,
                                                                                                         behavior
                                                                                                     }) => {
    const commands = behavior.schema || [];
    const [expandedCommandId, setExpandedCommandId] = useState<number | null>(null);
    const initialCommandValues = useMemo(() => initializeCommandValues(commands), [behavior.schema]);
    const [commandValues, setCommandValues] = useState<Map<number, Map<number, CommandValue>>>(initialCommandValues);
    const alerts = useAlerts()
    // useEffect(() => {
    //     setCommandValues(initialCommandValues);
    //     setExpandedCommandId(null);
    // }, [initialCommandValues]);

    const handleExpand = useCallback((commandId: number) => {
        setExpandedCommandId(commandId);
    }, []);

    const handleCollapse = useCallback(() => {
        setExpandedCommandId(null);
    }, []);

    const handleValueChange = useCallback((commandId: number, paramId: number, newValue: any) => {
        setCommandValues(prev => {
            const params = prev.get(commandId)
            if (!params) {
                return prev
            }

            params.set(paramId, newValue)

            return prev
        });
    }, []);

    const handleExecute = useCallback((commandId: number) => {
        const def = commands.find((command) => command.id === commandId);
        const values = def?.id ? commandValues.get(def.id) : undefined;
        if (!def || !values) {
            return
        }

        for (let parameter of def.parameters) {
            if (!values.has(parameter.index)) {
                alerts.showAlert("warning", "Configure all the parameters of this command first.")
                return
            }
        }

        const sortedValues = def.parameters.sort((a, b) => a.index - b.index)
            .map((p) => values.get(p.index)!)

        const command = `[${def.name}${sortedValues.length > 0 ? " " + sortedValues.join(" ") : ""}]\n`

        project.write(command)
    }, [project, commands]);

    return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2 p-2">
            {commands.length === 0 ? (
                <p className="text-gray-500 col-span-3 text-center py-10">
                    No commands defined. Edit the widget to add commands.
                </p>
            ) : (
                commands.map(command => (
                    <CommandItem
                        key={command.id}
                        command={command}
                        expandedId={expandedCommandId}
                        onExpand={handleExpand}
                        onCollapse={handleCollapse}
                        onExecute={handleExecute}
                        values={commandValues.get(command.id)!}
                        onValueChange={handleValueChange}
                    />
                ))
            )}
        </div>
    );
};

/**
 * Header Component
 */
const Header: React.FC<{
    behavior: WidgetBehavior<"commandPanel">,
    Container: React.FC<ToolContainerProps>
}> = ({Container}) => {
    return (
        <Container>
            <div className="p-2 text-lg md:text-xl font-semibold text-gray-900 shadow-sm">
                <h2>
                    Device Commands
                </h2>
            </div>
        </Container>
    );
};

/**
 * Rebuilt Configuration Component
 * Updated: Removed immer dependency
 */

// --- Reusable Input Components ---
const ConfigInput: React.FC<{ label: string, value: string, onChange: (val: string) => void }> = ({
                                                                                                      label,
                                                                                                      value,
                                                                                                      onChange,
                                                                                                  }) => (
    <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
    </div>
);

const ConfigSelect: React.FC<{
    label: string,
    value: string,
    onChange: (val: CommandType) => void,
    children: React.ReactElement<DropdownItemProps> | React.ReactElement<DropdownItemProps>[]
}> = ({label, value, onChange, children}) => (
    <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <Dropdown
            value={value}
            onSelect={e => onChange(e as CommandType)}
            // className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
            {children}
        </Dropdown>
    </div>
);


// type ConfigCommandDefinition = CommandDefinition & {
//     _internalId: string; // Stable ID for React list key
// };


const CommandDefinitionConfiguration: React.FC<{
    definition: CommandDefinition,
    setDefinition: (definition: CommandDefinition) => void
}> = ({definition, setDefinition}) => {
    const paramCounter = Math.max(...definition.parameters.map(it => it.index), 0);

    const handleAddParam = () => {
        const newId = paramCounter + 1;
        setDefinition({
            ...definition,
            parameters: [
                ...definition.parameters,
                {
                    index: newId,
                    displayName: `Parameter ${newId}`,
                    type: "string",
                }
            ],
        });
    }

    const handleRemoveParam = (index: number) => {
        setDefinition({
            ...definition,
            parameters: definition.parameters.filter(it => it.index !== index),
        });
    }

    return <div className="w-1/2 p-4 overflow-y-auto">
        <div>
            <h3 className="text-lg font-semibold mb-4">Edit Command</h3>
            <ConfigInput label="Command ID" value={definition.name}
                         onChange={val => setDefinition({
                             ...definition,
                             name: val
                         })}/>
            <ConfigInput label="Display Name" value={definition.displayName}
                         onChange={val => setDefinition({
                             ...definition,
                             displayName: val
                         })}/>
            <ConfigInput label="Icon Name" value={definition.icon}
                         onChange={val => setDefinition({
                             ...definition,
                             icon: val
                         })}/>

            {/* Parameters Editor */}
            <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-semibold">Parameters</h4>
                    <button
                        onClick={handleAddParam}
                        className="flex items-center px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm"
                    >
                        <span className="text-lg mr-1">+</span> Add
                    </button>
                </div>
                <div className="space-y-4">
                    {definition.parameters.length === 0 ? (
                        <p className="text-gray-500 text-sm">No parameters defined.</p>
                    ) : (
                        definition.parameters.map((param) => (
                            <div key={param.index}
                                 className="p-3 border border-gray-200 rounded-md bg-gray-50 relative">
                                <button
                                    onClick={() => handleRemoveParam(param.index)}
                                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-amber-600 rounded-full font-bold"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none"
                                         viewBox="0 0 24 24"
                                         stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                              d="M6 18L18 6M6 6l12 12"/>
                                    </svg>
                                </button>
                                <ConfigInput label="Display Name" value={param.displayName}
                                             onChange={val => {
                                                 setDefinition({
                                                     ...definition,
                                                     parameters: definition.parameters.map(p => p.index == param.index ? {
                                                             ...param,
                                                             displayName: val,
                                                         } : p
                                                     )
                                                 })
                                             }}/>
                                <ConfigSelect label="Type" value={param.type}
                                              onChange={val => setDefinition({
                                                  ...definition,
                                                  parameters: definition.parameters.map(p => p.index == param.index ? {
                                                          ...param,
                                                          type: val,
                                                      } : p
                                                  )
                                              })}>
                                    <DropdownItem value="string">String</DropdownItem>
                                    <DropdownItem value="number">Number</DropdownItem>
                                </ConfigSelect>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    </div>
}

/**
 * Configuration Component
 * Updated: Uses local state and a "Finalize" button.
 */
const CommandSenderConfiguration: React.FC<{
    behavior: WidgetBehavior<"commandPanel">,
    setBehavior: SetBehavior<"commandPanel">,
    project: Project,
}> = ({behavior, setBehavior}) => {
    const commandIdCounter = useRef(Math.max(0, ...behavior.schema.map((it) => it.id)) + 1);

    const [selected, setSelected] = useState<number | null>(null);

    const selectedCommand = selected ? behavior.schema.find((it) => {
        return it.id == selected
    }) : undefined

    // --- Command Handlers (Update Local State using _internalId) ---
    const handleAddCommand = () => {
        let id = commandIdCounter.current++;
        const newCommand: CommandDefinition = {
            id: id,
            name: `command_${id}`,
            displayName: `New Command ${id}`,
            icon: 'Default',
            parameters: []
        };
        setBehavior({
            schema: [
                ...behavior.schema,
                newCommand
            ]
        })
        setSelected(id);
    };

    const handleRemoveCommand = (id: number) => {
        setBehavior({
            schema: behavior.schema.filter(it => it.id !== id)
        })
        // setDefinitions(curr => {
        //     const next = new Map(curr)
        //     next.delete(internalId)
        //     return next
        // })
        if (selected === id) {
            setSelected(null);
        }
    };

    // const handleFinalize = () => {
    //     const cleanCommands: CommandDefinition[] = Array.from(definitions.values())
    //
    //     console.log(cleanCommands)
    //     setBehavior({
    //         schema: cleanCommands,
    //     });
    // };

    return (
        <div className="flex flex-col w-full h-full min-h-[400px]">
            <div className="flex flex-1 overflow-hidden">
                <div className="w-1/2 border-r mr-3 border-gray-200 p-4 overflow-y-auto">
                    <h3 className="text-lg font-semibold mb-4">Commands</h3>
                    <button
                        onClick={handleAddCommand}
                        className="flex items-center justify-center px-4 py-2 mb-4 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                        <span className="text-xl mr-2">+</span> Define Command
                    </button>
                    <div className="space-y-2">
                        {behavior.schema.map((cmd) => (
                            <div
                                key={cmd.id}
                                onClick={() => setSelected(cmd.id)}
                                className={`flex items-center justify-between p-2 rounded-md cursor-pointer ${selected === cmd.id ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                            >
                                <span className="font-medium text-gray-800">{cmd.displayName}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveCommand(cmd.id);
                                    }}
                                    className="p-1 text-gray-400 hover:text-amber-600 rounded-full font-bold"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none"
                                         viewBox="0 0 24 24"
                                         stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                              d="M6 18L18 6M6 6l12 12"/>
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Command Editor Panel */}
                {!selectedCommand ? (
                    <div className="w-1/2 flex my-auto text-center items-center justify-center h-full text-gray-500">
                        <p>
                            Select a command to edit or add a new one.
                        </p>
                    </div>
                ) : (
                    <CommandDefinitionConfiguration
                        definition={selectedCommand}
                        setDefinition={(def) => {
                            setBehavior({
                                schema: behavior.schema.map((it) => it.id == def.id ? def : it),
                            })
                            // setDefinitions(currentCommands => {
                            //     currentCommands.set(selected!, def)
                            //     return currentCommands
                            // });
                            // handleFinalize();
                        }}
                    />
                )}
            </div>

            {/*/!* Finalize Button *!/*/}
            {/*<div className="p-4 border-t border-gray-200 bg-gray-50 text-right">*/}
            {/*    <button*/}
            {/*        onClick={handleFinalize}*/}
            {/*        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"*/}
            {/*    >*/}
            {/*        Apply Changes*/}
            {/*    </button>*/}
            {/*</div>*/}
        </div>
    );
}

/**
 * Tool Export
 */
export const CommandSender: WidgetHandler<"commandPanel"> = {
    configurator({project, behavior, setBehavior}): React.ReactElement {
        return <CommandSenderConfiguration project={project} behavior={behavior ?? {
            type: 'commandPanel',
            schema: []
        }} setBehavior={setBehavior}/>
    },
    header: (
        behavior
        , container
    ) => <Header behavior={behavior} Container={container}/>,
    type: "command-panel",
    behaviorType: "commandPanel",
    displayName: "Command Panel",
    widget: (
        project,
        behavior
    ) => <WidgetView
        project={project}
        behavior={behavior}
    />
};