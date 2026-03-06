import { useTheme, type GenderTheme } from '@/hooks/useTheme';
import { Button } from '@/components/shared/ui/button';

export function ThemeSelector() {
    const { theme, setTheme } = useTheme();

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
        </div>
    );
}
