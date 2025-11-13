import React, {PropsWithChildren, useEffect, useRef, useState} from "react";
import Button from "./button.tsx"; // Assuming button.tsx exists

// --- This component is unchanged ---
export type DropdownItemProps = {
    value: string;
    onClick?: () => void;
    isSelected?: boolean;
} & PropsWithChildren

export function DropdownItem({children, onClick, isSelected}: DropdownItemProps) {
    const className = `
    block px-4 py-2 text-sm cursor-pointer transition-colors duration-200
    ${isSelected
        ? "bg-blue-500 text-white font-semibold"
        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
    }`;
    return (
        <div className={className} onClick={onClick} role="menuitem" tabIndex={-1}>
            {children}
        </div>
    );
}

// --- This component has been modified ---
export function Dropdown({
                             children = [],
                             className = "",
                             placeholder = "Select...",
                             ifEmpty = <p>Nothing here...</p>,
                             onSelect,
                             value = null,
                         }: {
    children?: React.ReactElement<DropdownItemProps> | React.ReactElement<DropdownItemProps>[],
    className?: string,
    placeholder?: string,
    ifEmpty?: React.ReactElement,
    onSelect: (value: string) => void,
    value?: string | null,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // **NEW**: Ref for the menu element
    const menuRef = useRef<HTMLDivElement>(null);

    // Close the dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // **NEW**: Adjust menu height to fit within the viewport
    useEffect(() => {
        if (isOpen && menuRef.current) {
            const menu = menuRef.current;
            const rect = menu.getBoundingClientRect();
            const viewportHeight = window.innerHeight;

            // Calculate max height, leaving a 1rem (16px) buffer from the bottom
            const maxHeight = viewportHeight - rect.top - 16;

            menu.style.maxHeight = `${maxHeight}px`;
        }
    }, [isOpen]); // Reruns when the dropdown is opened/closed

    const handleItemClick = (itemValue: string) => {
        setIsOpen(false);
        if (onSelect) {
            onSelect(itemValue);
        }
    };

    const getLabel = () => {
        if (value) {
            const selectedChild = React.Children.toArray(children).find(
                (child) => React.isValidElement(child) && (child.props as any).value === value
            ) as React.ReactElement<DropdownItemProps> | undefined;
            return selectedChild ? selectedChild.props.children : placeholder;
        }
        return placeholder;
    };

    const items = React.Children.map(children, (child) => {
        // Ensure we are only rendering DropdownItems
        if (React.isValidElement<DropdownItemProps>(child) && child.type === DropdownItem) {
            return React.cloneElement(child, {
                onClick: () => handleItemClick(child.props.value),
                isSelected: child.props.value === value,
            });
        }
        return null;
    });

    return (
        <div className={`${className ?? ""} relative inline-block w-full max-w-xs`} ref={dropdownRef}>
            {/* Dropdown button */}
            <Button
                type="button"
                className="flex items-center justify-between w-full px-2 py-1"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                {getLabel()}
                <svg
                    className={`-mr-1 ml-2 h-5 w-5 text-gray-400 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
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
            </Button>

            {/* Dropdown menu */}
            {isOpen && (
                <div
                    // **NEW**: Added ref
                    ref={menuRef}
                    className="
                    w-full bg-white min-w-fit shadow-lg
                     absolute right-0 z-10 mt-2 origin-top-right
                     transform scale-y-100 opacity-100 transition-all duration-200 ease-in-out
                     py-1 overflow-y-auto" // **MODIFIED**: Added py-1 and overflow-y-auto
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="menu-button"
                    tabIndex={-1}
                >
                    {/* **MODIFIED**: Removed the inner wrapper div */}

                    {/* Map over children to render items */}
                    {items.length != 0 ? items : <DropdownItem value={"0"}>{ifEmpty}</DropdownItem>}
                </div>
            )}
        </div>
    );
}