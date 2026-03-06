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
        // Mocking user session for demonstration and UI compatibility
        // In a real scenario, this would check an Odoo session cookie or token
        const mockUser: User = {
            id: 'demo-user',
            email: 'cliente@ejemplo.com',
            name: 'Cliente Natura',
            role: 'user'
        };

        setUser(mockUser);
        setIsLoading(false);
    }, []);

    const loginWithGoogle = async () => {
        // TODO: Implement Odoo OAuth2 or social login
        console.log('Login not implemented yet');
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('odoo_session');
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, loginWithGoogle, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
