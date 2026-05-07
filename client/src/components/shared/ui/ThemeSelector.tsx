import { Button } from '@/components/shared/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export function ThemeSelector() {
    const { isDark, toggleDarkMode } = useTheme();

    return (
        <Button
            variant="outline"
            size="icon"
            onClick={toggleDarkMode}
            className="h-11 w-11 shrink-0 rounded-2xl border-primary/15 bg-background/80 text-foreground shadow-sm hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
            title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
    );
}
