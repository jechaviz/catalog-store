import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Phone } from 'lucide-react';

export function Footer() {
    const [phone, setPhone] = useState('');

    const handleSubscribe = (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone) return;

        // Simulating WhatsApp subscription
        const message = encodeURIComponent(`Hola, me gustaría suscribirme a las actualizaciones del catálogo. Mi número es: ${phone}`);
        window.open(`https://wa.me/5211234567890?text=${message}`, '_blank');
        setPhone('');
    };

    return (
        <footer className="bg-secondary/5 border-t border-primary/10 pt-16 pb-8 mt-20">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                    {/* Brand Info */}
                    <div>
                        <h2 className="display text-2xl font-bold text-primary mb-4">
                            Natura <span className="text-secondary">Catálogo</span>
                        </h2>
                        <p className="body text-muted-foreground mb-6">
                            Bienestar Bien. Cosméticos, fragancias y cuidado personal inspirados en la naturaleza y la biodiversidad.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="heading font-bold text-lg mb-4 text-foreground">Enlaces Rápidos</h3>
                        <ul className="space-y-3 body text-muted-foreground">
                            <li><button className="hover:text-primary transition-colors">Sobre Natura</button></li>
                            <li><button className="hover:text-primary transition-colors">Términos y Condiciones</button></li>
                            <li><button className="hover:text-primary transition-colors">Políticas de Privacidad</button></li>
                            <li><button className="hover:text-primary transition-colors">Contacto</button></li>
                        </ul>
                    </div>

                    {/* WhatsApp Subscription */}
                    <div>
                        <h3 className="heading font-bold text-lg mb-4 text-foreground flex items-center gap-2">
                            <Phone className="w-5 h-5 text-green-500" />
                            Actualizaciones por WhatsApp
                        </h3>
                        <p className="body text-sm text-muted-foreground mb-4">
                            Déjanos tu número de WhatsApp para recibir promociones exclusivas y el catálogo mensual.
                        </p>
                        <form onSubmit={handleSubscribe} className="flex gap-2 relative">
                            <Input
                                type="tel"
                                placeholder="Tu número a 10 dígitos"
                                className="bg-white border-primary/20 pr-12"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                                pattern="[0-9]{10}"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                className="absolute right-1 top-1 h-8 w-8 bg-green-500 hover:bg-green-600 text-white rounded-md"
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </form>
                    </div>
                </div>

                <div className="pt-8 border-t border-primary/10 text-center body text-sm text-muted-foreground">
                    <p>© {new Date().getFullYear()} Natura. Todos los derechos reservados. No es un sitio oficial.</p>
                </div>
            </div>
        </footer>
    );
}
