import { useState, useEffect } from 'react';

export type GenderTheme = 'female' | 'male' | 'unisex';

export function useTheme() {
    const [theme, setThemeState] = useState<GenderTheme>('female');

    useEffect(() => {
        // Look up saved preference or default to female
        const savedTheme = localStorage.getItem('natura_theme_preference') as GenderTheme | null;
        if (savedTheme && ['female', 'male', 'unisex'].includes(savedTheme)) {
            setThemeState(savedTheme);
            applyTheme(savedTheme);
        } else {
            applyTheme('female');
        }
    }, []);

    const applyTheme = (newTheme: GenderTheme) => {
        const root = document.documentElement;
        // Remove all theme classes first
        root.classList.remove('theme-female', 'theme-male', 'theme-unisex');
        // Add the new theme class
        root.classList.add(`theme-${newTheme}`);
    };

    const setTheme = (newTheme: GenderTheme) => {
        setThemeState(newTheme);
        localStorage.setItem('natura_theme_preference', newTheme);
        applyTheme(newTheme);
    };

    return { theme, setTheme };
}
