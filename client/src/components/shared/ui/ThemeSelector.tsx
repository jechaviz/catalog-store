import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/shared/ui/button';
import { Moon, Sun } from 'lucide-react';
export function ThemeSelector() {
    const { theme, setTheme, isDark, toggleDarkMode } = useTheme();
    return (
        <div className="flex items-center gap-2 bg-secondary/10 p-1 rounded-full border border-primary/20 shadow-inner">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme('female')}
                className={`rounded-full px-4 font-semibold text-xs uppercase tracking-widest transition-all ${theme === 'female'
                    ? 'bg-primary text-white shadow-md'
                    : 'text-foreground/70 hover:text-primary'
                    }`}
            >
                Mujeres
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme('male')}
                className={`rounded-full px-4 font-semibold text-xs uppercase tracking-widest transition-all ${theme === 'male'
                    ? 'bg-primary text-white shadow-md'
                    : 'text-foreground/70 hover:text-primary'
                    }`}
            >
                Hombres
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme('unisex')}
                className={`rounded-full px-4 font-semibold text-xs uppercase tracking-widest transition-all ${theme === 'unisex'
                    ? 'bg-primary text-white shadow-md'
                    : 'text-foreground/70 hover:text-primary'
                    }`}
            >
                Unisex
            </Button>
            
            <div className="w-[1px] h-4 bg-primary/20 mx-1"></div>
            <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                className="rounded-full w-8 h-8 text-foreground/70 hover:text-primary transition-all hover:bg-primary/10 flex items-center justify-center shrink-0"
                title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
        </div>
    );
}
