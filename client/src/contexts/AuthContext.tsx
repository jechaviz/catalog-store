import { createContext, useContext, useEffect, useState } from 'react';
import { pb } from '@/lib/pb';
import type { RecordModel } from 'pocketbase';

interface AuthContextType {
    user: RecordModel | null;
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
    const [user, setUser] = useState<RecordModel | null>(pb.authStore.record);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Listen to changes in the auth store (login/logout events)
        const unsubscribe = pb.authStore.onChange((token, model) => {
            setUser(model);
        });

        // Check if current user is valid (optional, e.g. token refresh, but local check is usually fine)
        if (pb.authStore.isValid && pb.authStore.record) {
            setUser(pb.authStore.record);
        } else {
            setUser(null);
        }

        setIsLoading(false);

        return () => unsubscribe();
    }, []);

    const loginWithGoogle = async () => {
        try {
            // Initiates the OAuth2 login flow with Google. 
            // Note: PocketBase must be configured with Google provider in its admin UI.
            const authData = await pb.collection('users').authWithOAuth2({ provider: 'google' });
            console.log('Logged in successfully', authData);
        } catch (error) {
            console.error('Google Auth Error:', error);
            // Handle gracefully if user closes the modal or errors out
        }
    };

    const logout = () => {
        pb.authStore.clear();
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, loginWithGoogle, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
