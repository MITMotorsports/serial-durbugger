import React, {
    DetailedHTMLProps,
    InputHTMLAttributes,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from "react";
import {DropdownItem} from "./dropdown.tsx";

type InputProps = DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;

export type AutocompleteProps = {
    knownValues: string[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    emptyMessage?: string;
} & Omit<InputProps, "onChange">

export function Autocomplete({
                                 knownValues = [],
                                 value,
                                 onChange,
                                 placeholder = "Type or select...",
                                 className = "",
                                 emptyMessage = "No matching options",
                                ...props
                             }: AutocompleteProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [placement, setPlacement] = useState<"top" | "bottom">("bottom");

    // We track if the user is specifically asking to see the FULL list via the arrow button
    const [showAllOverride, setShowAllOverride] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setShowAllOverride(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // **Smart Positioning & Corner Handling**
    // Uses useLayoutEffect to measure before paint to prevent flickering
    useLayoutEffect(() => {
        if (isOpen && menuRef.current && containerRef.current) {
            const menu = menuRef.current;
            const inputRect = containerRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - inputRect.bottom;
            const spaceAbove = inputRect.top;

            // Minimum height we want to guarantee for the menu
            const minHeightNeeded = 150;

            // If constrained below but have space above, flip to top
            if (spaceBelow < minHeightNeeded && spaceAbove > spaceBelow) {
                setPlacement("top");
                // Max height is space above minus a small buffer
                menu.style.maxHeight = `${spaceAbove - 16}px`;
            } else {
                setPlacement("bottom");
                // Max height is space below minus buffer
                menu.style.maxHeight = `${spaceBelow - 16}px`;
            }
        }
    }, [isOpen, value, knownValues]); // Re-calc when data changes or menu opens

    // Filter logic
    const filteredItems = useMemo(() => {
        // If user clicked the arrow (showAllOverride), show everything.
        if (showAllOverride) return knownValues;

        // If input is empty, show everything.
        if (!value) return knownValues;

        // Otherwise, filter based on input
        const lowerVal = value.toLowerCase();
        return knownValues.filter(item => item.toLowerCase().includes(lowerVal));
    }, [knownValues, value, showAllOverride]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
        setShowAllOverride(false); // Reset override so filtering works again
        setIsOpen(true);
    };

    const handleItemClick = (itemValue: string) => {
        onChange(itemValue);
        setIsOpen(false);
        setShowAllOverride(false);
    };

    const toggleDropdown = () => {
        if (isOpen) {
            setIsOpen(false);
            setShowAllOverride(false);
        } else {
            setIsOpen(true);
            setShowAllOverride(true); // Arrow click implies "Show me everything"

            // Optional: Focus input so they can immediately type after opening
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    };

    return (
        <div className={`${className} relative inline-block w-full max-w-xs`} ref={containerRef}>
            {/* Input Wrapper - styled to look like the Button from the previous example */}
            <div className="flex items-center w-full relative">
                <input
                    ref={inputRef}
                    type={"text"}
                    className="w-full px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                    placeholder={placeholder}
                    value={value}
                    onChange={handleInputChange}
                    onClick={() => setIsOpen(true)} // clicking text opens menu
                    aria-expanded={isOpen}
                    autoComplete="off" // Disable browser native autocomplete
                    {...props}
                />

                {/* Toggle Arrow Button - Absolute positioned right */}
                <button
                    type="button"
                    className="absolute right-0 inset-y-0 px-2 flex items-center cursor-pointer text-gray-400 hover:text-gray-600 focus:outline-none"
                    onClick={toggleDropdown}
                    tabIndex={-1} // Prevent tab stop, keep flow on input
                >
                    <svg
                        className={`h-5 w-5 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                        />
                    </svg>
                </button>
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    ref={menuRef}
                    className={`
                        w-full bg-white min-w-fit shadow-lg rounded-md border border-gray-200
                        absolute z-50 overflow-y-auto py-1
                        transition-all duration-200 ease-in-out
                        ${placement === 'bottom' ? 'mt-1 top-full origin-top' : 'mb-1 bottom-full origin-bottom'}
                    `}
                    role="menu"
                >
                    {filteredItems.length > 0 ? (
                        filteredItems.map((item, index) => (
                            <DropdownItem
                                key={`${item}-${index}`}
                                value={item}
                                onClick={() => handleItemClick(item)}
                                isSelected={item === value}
                            >
                                {item}
                            </DropdownItem>
                        ))
                    ) : (
                        <div className="px-4 py-2 text-sm text-gray-500 italic">
                            {emptyMessage}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}