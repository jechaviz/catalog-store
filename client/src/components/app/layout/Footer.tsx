import { type FormEvent, useState } from 'react';
import { useLocation } from 'wouter';
import { Send, Phone } from 'lucide-react';
import { CONFIG } from '@/config';
import { useBrand } from '@/contexts/BrandContext';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';

export function Footer() {
    const [phone, setPhone] = useState('');
    const { isNikken } = useBrand();
    const [, setLocation] = useLocation();

    const brandName = isNikken ? 'Nikken' : 'Natura';
    const homePath = isNikken ? '/nikken' : '/';
    const profilePath = isNikken ? '/nikken/profile' : '/profile';
    const ordersPath = isNikken ? '/nikken/account/orders' : '/account/orders';
    const returnsPath = isNikken ? '/nikken/account/returns' : '/account/returns';
    const checkoutPath = isNikken ? '/nikken/checkout' : '/checkout';

    const quickLinks = [
        { label: isNikken ? 'Explorar bienestar' : 'Explorar catalogo', href: homePath },
        { label: 'Mis pedidos', href: ordersPath },
        { label: 'Devoluciones', href: returnsPath },
        { label: 'Mi perfil', href: profilePath },
        { label: 'Finalizar pedido', href: checkoutPath },
    ];

    const handleSubscribe = (e: FormEvent) => {
        e.preventDefault();

        const normalizedPhone = phone.replace(/\D/g, '');

        if (normalizedPhone.length < 10) return;

        const message = encodeURIComponent(
            `Hola, quiero recibir novedades del catalogo de ${brandName}. Mi numero es: ${normalizedPhone}`
        );

        window.open(
            `${CONFIG.SELLER.WHATSAPP_BASE_URL}${CONFIG.SELLER.PHONE}?text=${message}`,
            '_blank'
        );
        setPhone('');
    };

    return (
        <footer className="bg-secondary/5 border-t border-primary/10 pt-16 pb-8 mt-20">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                    <div>
                        <h2 className="display text-2xl font-bold text-primary mb-4">
                            {isNikken ? (
                                <>
                                    Nikken <span className="text-secondary font-light">Wellness</span>
                                </>
                            ) : (
                                <>
                                    Natura <span className="text-secondary">Catalogo</span>
                                </>
                            )}
                        </h2>
                        <p className="body text-muted-foreground mb-6">
                            {isNikken
                                ? 'Bienestar, descanso e hidratacion con acompanamiento cercano para cada pedido.'
                                : 'Fragancias, cuidado personal y belleza consciente para acompanarte todos los dias.'}
                        </p>
                    </div>

                    <div>
                        <h3 className="heading font-bold text-lg mb-4 text-foreground">Enlaces utiles</h3>
                        <ul className="space-y-3 body text-muted-foreground">
                            {quickLinks.map((link) => (
                                <li key={link.href}>
                                    <button
                                        type="button"
                                        onClick={() => setLocation(link.href)}
                                        className="hover:text-primary transition-colors"
                                    >
                                        {link.label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h3 className="heading font-bold text-lg mb-4 text-foreground flex items-center gap-2">
                            <Phone className="w-5 h-5 text-green-500" />
                            Novedades por WhatsApp
                        </h3>
                        <p className="body text-sm text-muted-foreground mb-4">
                            {isNikken
                                ? 'Dejanos tu numero y te compartimos promociones, novedades y ayuda para tus pedidos Nikken.'
                                : 'Dejanos tu numero y te compartimos lanzamientos, promociones y el catalogo vigente de Natura.'}
                        </p>
                        <form onSubmit={handleSubscribe} className="flex gap-2 relative">
                            <Input
                                type="tel"
                                placeholder="Tu numero de WhatsApp"
                                className="bg-white border-primary/20 pr-12"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                                pattern="[0-9]{10}"
                                inputMode="numeric"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                className="absolute right-1 top-1 h-8 w-8 bg-green-500 hover:bg-green-600 text-white rounded-md"
                                title="Suscribirme por WhatsApp"
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </form>
                    </div>
                </div>

                <div className="pt-8 border-t border-primary/10 text-center body text-sm text-muted-foreground space-y-1">
                    <p>Copyright {new Date().getFullYear()} {isNikken ? 'Distribuidor Independiente Nikken' : 'Catalogo Natura'}.</p>
                    <p className="text-xs opacity-70">
                        {isNikken
                            ? 'Este sitio es operado por un distribuidor independiente y no representa a Nikken Inc.'
                            : 'Sitio operado por una consultora independiente para compartir catalogo y tomar pedidos.'}
                    </p>
                </div>
            </div>
        </footer>
    );
}
