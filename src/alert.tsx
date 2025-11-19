import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';

interface Alert {
    id: string;
    type: 'info' | 'warning' | 'error';
    message: string;
    isFadingOut: boolean;
}

interface AlertContextType {
    showAlert: (type: Alert['type'], message: string) => void;
    initiateDismissal: (id: string) => void;
}

const ANIMATION_DURATION = 500; // Must match the transition duration in AlertItem component

const AlertContext = createContext<AlertContextType | undefined>(undefined);

/**
 * Custom hook to consume the AlertContext, making it easy to access showAlert from any component.
 */
export const useAlerts = (): AlertContextType => {
    const context = useContext(AlertContext);
    if (context === undefined) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
};

// --- 3. PROVIDER COMPONENT (State & Logic) ---

/**
 * Manages the state and core logic for all alerts, and provides the functions via context.
 */
export const AlertProvider: React.FC<{ children: React.ReactNode, timeout?: number }> = ({ children, timeout = 6000 }) => {
    const [alerts, setAlerts] = useState<Alert[]>([]);

    // Function to perform the final removal from the state array.
    const dismissAlert = useCallback((id: string) => {
        setAlerts(prevAlerts => prevAlerts.filter(alert => alert.id !== id));
    }, []);

    // Function to initiate the fade-out animation and schedule the final removal.
    const initiateDismissal = useCallback((id: string) => {
        // 1. Trigger the animation by setting the fading state
        setAlerts(prevAlerts =>
            prevAlerts.map(alert =>
                alert.id === id ? { ...alert, isFadingOut: true } : alert
            )
        );

        // 2. Set a timer to perform the final cleanup after the fade-out animation completes
        setTimeout(() => {
            dismissAlert(id);
        }, ANIMATION_DURATION);

    }, [dismissAlert]);

    // Memoized function to add a new alert to the state and set a dismissal timer.
    const showAlert = useCallback((type: Alert['type'], message: string) => {
        // Generate a unique ID for the alert
        const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
        const newAlert: Alert = { id, type, message, isFadingOut: false };

        // Add new alert to the front of the array (newest alerts stack downward)
        setAlerts(prevAlerts => [newAlert, ...prevAlerts]);

        // Set auto-dismissal timer, which calls initiateDismissal after 'timeout'
        const timer = setTimeout(() => {
            initiateDismissal(id);
        }, timeout);

        // Return a cleanup function to prevent memory leaks if the app unmounts prematurely
        return () => clearTimeout(timer);
    }, [initiateDismissal, timeout]);

    const contextValue = useMemo(() => ({ showAlert, initiateDismissal }), [showAlert, initiateDismissal]);

    return (
        <AlertContext.Provider value={contextValue}>
            {children}
            {/* The Alert Container is rendered here, outside the children, but within the Provider scope */}
            <AlertContainer alerts={alerts} dismiss={initiateDismissal} />
        </AlertContext.Provider>
    );
};


// --- 4. ALERT ITEM COMPONENT (Display Logic) ---

/**
 * Displays a single, dismissible alert notification.
 */
const AlertItem: React.FC<{ alert: Alert; dismiss: (id: string) => void }> = ({ alert, dismiss }) => {
    const [isAnimating, setIsAnimating] = useState(true); // Control slide-in animation

    const { type, message, id, isFadingOut } = alert;

    // Effect for handling the slide-in animation on mount
    useEffect(() => {
        const animationTimeout = setTimeout(() => {
            setIsAnimating(false);
        }, 50);
        return () => clearTimeout(animationTimeout);
    }, []);

    // Handler for dismissal
    const handleDismiss = useCallback(() => {
        dismiss(id);
    }, [dismiss, id]);


    // Determine Tailwind classes and SVG based on the alert type
    const { colorClasses, iconSvg } = useMemo(() => {
        switch (type) {
            case 'info':
                return {
                    colorClasses: 'bg-green-50 border-green-300 text-green-800',
                    iconSvg: (
                        <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    ),
                };
            case 'warning':
                return {
                    colorClasses: 'bg-yellow-50 border-yellow-300 text-yellow-800',
                    iconSvg: (
                        <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    ),
                };
            case 'error':
                return {
                    colorClasses: 'bg-red-50 border-red-300 text-red-800',
                    iconSvg: (
                        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    ),
                };
            default:
                return { colorClasses: '', iconSvg: null };
        }
    }, [type]);

    // Combined class string for animation
    const animationClass = isFadingOut
        ? 'opacity-0 translate-x-full'
        : isAnimating
            ? 'opacity-0 translate-x-full'
            : 'opacity-100 translate-x-0';

    // Conditional styling for the vertical collapse animation
    const collapseStyle = isFadingOut ? {
        maxHeight: '0px',
        paddingTop: '0px',
        paddingBottom: '0px',
        opacity: 0,
        marginTop: '0px',
        marginBottom: '0px',
    } : {};

    return (
        <div
            className={`
        w-full p-4 pr-12 rounded-lg border-l-4 shadow-lg flex space-x-3
        transition-all duration-500 ease-in-out cursor-pointer items-center justify-center
        ${colorClasses} ${animationClass}
      `}
            onClick={handleDismiss} // Allow clicking the body to dismiss
            role="alert"
            style={collapseStyle}
        >
            <div className="mt-0.5">{iconSvg}</div>
            <div className="text-sm font-medium items-center justify-center">
                <span className="capitalize font-bold">{type}</span>: {message}
            </div>
            <button
                aria-label="Dismiss alert"
                className="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-700 z-10"
                onClick={(e) => {
                    e.stopPropagation(); // Prevent the parent div's onClick from firing
                    handleDismiss();
                }}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
    );
};

/**
 * Component that renders all active AlertItems in the fixed top-right position.
 */
const AlertContainer: React.FC<{ alerts: Alert[]; dismiss: (id: string) => void }> = ({ alerts, dismiss }) => {
    return (
        <div
            id="alert-container"
            className="fixed top-4 right-4 z-50 flex flex-col items-end space-y-3 p-2
                       max-h-full overflow-y-auto"
        >
            {alerts.map((alert) => (
                <AlertItem key={alert.id} alert={alert} dismiss={dismiss} />
            ))}
        </div>
    );
};
