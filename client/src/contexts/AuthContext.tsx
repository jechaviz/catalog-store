import { createContext, useContext, useEffect, useState } from 'react';

interface User {
    id: string;
    email: string;
    name?: string;
    avatar?: string;
    role?: 'admin' | 'user';
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    loginWithGoogle: () => Promise<void>;
    logout: () => void;
}

const SESSION_STORAGE_KEY = 'odoo_session';
const MOCK_USER_STORAGE_KEY = 'odoo_mock_user';
const MOCK_SESSION_TOKEN = 'mock-google-session';

const DEFAULT_MOCK_USER: User = {
    id: 'demo-user',
    email: 'cliente@ejemplo.com',
    name: 'Cliente Natura',
    role: 'user'
};

const createMockUser = (): User => ({
    ...DEFAULT_MOCK_USER,
});

const isUser = (value: unknown): value is User => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<User>;

    return typeof candidate.id === 'string'
        && typeof candidate.email === 'string'
        && (candidate.name === undefined || typeof candidate.name === 'string')
        && (candidate.avatar === undefined || typeof candidate.avatar === 'string')
        && (candidate.role === undefined || candidate.role === 'admin' || candidate.role === 'user');
};

const readLegacyUser = (value: unknown): User | null => {
    if (isUser(value)) {
        return { ...createMockUser(), ...value };
    }

    if (!value || typeof value !== 'object' || !('user' in value)) {
        return null;
    }

    const legacyUser = (value as { user?: unknown }).user;

    return isUser(legacyUser) ? { ...createMockUser(), ...legacyUser } : null;
};

const clearStoredMockSession = () => {
    try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        localStorage.removeItem(MOCK_USER_STORAGE_KEY);
    } catch {
        // Ignore storage cleanup failures and keep the in-memory session consistent.
    }
};

const persistMockSession = (nextUser: User) => {
    try {
        localStorage.setItem(SESSION_STORAGE_KEY, MOCK_SESSION_TOKEN);
        localStorage.setItem(MOCK_USER_STORAGE_KEY, JSON.stringify(nextUser));
    } catch {
        // Keep the UI usable even if storage is unavailable.
    }
};

const restoreMockSession = (): User | null => {
    try {
        const storedSession = localStorage.getItem(SESSION_STORAGE_KEY);
        const storedMockUser = localStorage.getItem(MOCK_USER_STORAGE_KEY);

        if (!storedSession) {
            if (storedMockUser) {
                localStorage.removeItem(MOCK_USER_STORAGE_KEY);
            }

            return null;
        }

        if (storedSession === MOCK_SESSION_TOKEN) {
            if (!storedMockUser) {
                const repairedUser = createMockUser();
                persistMockSession(repairedUser);
                return repairedUser;
            }

            try {
                const parsedUser: unknown = JSON.parse(storedMockUser);

                if (isUser(parsedUser)) {
                    return { ...createMockUser(), ...parsedUser };
                }
            } catch {
                // Invalid mock user payload, clear the stale session below.
            }

            clearStoredMockSession();
            return null;
        }

        try {
            const legacySession: unknown = JSON.parse(storedSession);
            const legacyUser = readLegacyUser(legacySession);

            if (legacyUser) {
                persistMockSession(legacyUser);
                return legacyUser;
            }
        } catch {
            // Non-JSON session tokens are reserved for real auth flows; leave them untouched.
        }

        if (storedMockUser) {
            localStorage.removeItem(MOCK_USER_STORAGE_KEY);
        }

        return null;
    } catch {
        return null;
    }
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    loginWithGoogle: async () => { },
    logout: () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setUser(restoreMockSession());
        setIsLoading(false);
    }, []);

    useEffect(() => {
        const handleStorageChange = (event: StorageEvent) => {
            if (event.key && event.key !== SESSION_STORAGE_KEY && event.key !== MOCK_USER_STORAGE_KEY) {
                return;
            }

            setUser(restoreMockSession());
            setIsLoading(false);
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    const loginWithGoogle = async () => {
        if (user) {
            return;
        }

        setIsLoading(true);

        try {
            const nextUser = createMockUser();
            persistMockSession(nextUser);
            setUser(nextUser);
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        setUser(null);
        setIsLoading(false);
        clearStoredMockSession();
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, loginWithGoogle, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
