import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Heart, ShoppingBag, X } from 'lucide-react';
import { useLocation } from "wouter";
import { useColorExtraction, getLighterShade, getDarkerShade, getAnalogousColor } from '@/hooks/useColorExtraction';
import type { CatalogProduct } from '@/lib/dataFetcher';

interface ProductDetailProps {
    product: CatalogProduct | null;
    isOpen: boolean;
    onClose: () => void;
    onBuy: (product: CatalogProduct) => void;
    isLiked: boolean;
    onToggleLike: () => void;
}

export function ProductDetail({
    product,
    isOpen,
    onClose,
    onBuy,
    isLiked,
    onToggleLike,
}: ProductDetailProps) {
    const [_, setLocation] = useLocation();
    const colorData = useColorExtraction(product?.imageUrl || '');
    const primaryColor = colorData?.hex || '#F97316';
    const lightColor = getLighterShade(primaryColor, 35);
    const darkColor = getDarkerShade(primaryColor, 45); // Deeply darkened hue for typography

    // Analogous colors to break monotony while keeping the ambiance
    const analogousColor1 = getAnalogousColor(primaryColor, 35);
    const analogousColor2 = getAnalogousColor(primaryColor, -35);

    if (!product) return null;

    const handleDirectCheckout = () => {
        onBuy(product);
        setTimeout(() => {
            setLocation('/checkout');
        }, 800);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent showCloseButton={false} className="max-w-none sm:max-w-none md:max-w-none lg:max-w-none w-screen h-[100dvh] m-0 p-0 rounded-none border-none bg-background shadow-none overflow-y-auto overflow-x-hidden">
                <div className="w-full min-h-[100dvh] relative flex flex-col items-center p-4 sm:p-6 md:p-8 lg:p-12 overflow-x-hidden animate-in fade-in zoom-in-95 duration-700 ease-out">

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="fixed top-6 right-6 z-50 p-3 bg-white/60 backdrop-blur-xl hover:bg-white/90 border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 hover:scale-110 rounded-full group"
                    >
                        <X className="w-6 h-6 text-slate-700 group-hover:text-black transition-colors" />
                    </button>

                    {/* SVG Decorative Elements */}
                    <svg
                        className="absolute inset-0 w-full h-full opacity-100 pointer-events-none"
                        viewBox="0 0 1200 800"
                        preserveAspectRatio="xMidYMid slice"
                    >
                        <defs>
                            <filter id="blur-heavy">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
                            </filter>
                        </defs>

                        {/* Large organic blob top right */}
                        <path
                            d="M 850,80 Q 950,50 1050,120 Q 1150,200 1100,300 Q 1050,380 950,350 Q 850,320 850,200 Z"
                            fill={analogousColor1}
                            opacity="0.25"
                            filter="url(#blur-heavy)"
                            className="animate-pulse"
                        />

                        {/* Medium blob bottom left */}
                        <path
                            d="M 50,550 Q 30,650 100,720 Q 200,780 300,700 Q 350,620 280,550 Q 150,480 50,550 Z"
                            fill={analogousColor2}
                            opacity="0.28"
                            filter="url(#blur-heavy)"
                            className="animate-pulse"
                            style={{ animationDelay: '1.5s' }}
                        />

                        {/* Center-left extra blob */}
                        <circle cx="150" cy="300" r="120" fill={primaryColor} opacity="0.12" filter="url(#blur-heavy)" className="animate-pulse" />

                        {/* Curved line top */}
                        <path
                            d="M 0,0 Q 300,80 600,20 T 1200,0"
                            stroke={analogousColor1}
                            strokeWidth="3"
                            fill="none"
                            opacity="0.4"
                            strokeLinecap="round"
                        />

                        {/* Decorative curves */}
                        <path
                            d="M 1000,0 Q 1100,150 1050,300"
                            stroke={primaryColor}
                            strokeWidth="4"
                            fill="none"
                            opacity="0.35"
                            strokeLinecap="round"
                            className="animate-pulse"
                        />
                    </svg>

                    {/* Decorative dots pattern - animated */}
                    <div className="absolute top-4 right-4 sm:top-8 sm:right-8 md:top-12 md:right-12 space-y-2 sm:space-y-3 z-20">
                        {[...Array(6)].map((_, row) => (
                            <div key={row} className="flex gap-2 sm:gap-3">
                                {[...Array(5)].map((_, col) => {
                                    // Alternating colors for a playful grid
                                    const colors = [primaryColor, analogousColor1, primaryColor, analogousColor2];
                                    const dotColor = colors[(row + col) % colors.length];

                                    return (
                                        <div
                                            key={col}
                                            className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 rounded-full animate-bounce"
                                            style={{
                                                backgroundColor: dotColor,
                                                opacity: 0.6,
                                                animationDelay: `${(row + col) * 0.15}s`,
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    {/* Decorative ingredients/shapes - top left */}
                    <div className="absolute top-0 left-0 w-32 h-32 sm:w-40 sm:h-40 md:w-56 md:h-56 opacity-40 pointer-events-none">
                        <svg viewBox="0 0 200 200" className="w-full h-full animate-float">
                            <ellipse cx="40" cy="40" rx="25" ry="35" fill={analogousColor2} opacity="0.75" transform="rotate(-30 40 40)" />
                            <ellipse cx="90" cy="35" rx="22" ry="32" fill={primaryColor} opacity="0.65" transform="rotate(20 90 35)" />
                            <circle cx="55" cy="100" r="20" fill={analogousColor1} opacity="0.55" />
                        </svg>
                    </div>

                    {/* Decorative ingredients/shapes - bottom right */}
                    <div className="absolute bottom-0 right-0 w-32 h-32 sm:w-40 sm:h-40 md:w-56 md:h-56 opacity-35 pointer-events-none">
                        <svg viewBox="0 0 200 200" className="w-full h-full animate-float" style={{ animationDelay: '0.5s' }}>
                            <circle cx="160" cy="160" r="35" fill={analogousColor1} opacity="0.65" />
                            <circle cx="110" cy="180" r="28" fill={analogousColor2} opacity="0.55" />
                            <path d="M 180,110 Q 190,130 180,150 Q 170,140 180,110" fill={primaryColor} opacity="0.45" />
                        </svg>
                    </div>

                    {/* Main content grid */}
                    <div className="relative z-10 w-full max-w-6xl mx-auto xl:px-4 mt-20 md:mt-16 flex-1 flex items-center justify-center">
                        <div
                            className="bg-white/80 backdrop-blur-2xl rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1),inset_0_2px_4px_rgba(255,255,255,0.8)] border border-white/60 p-6 sm:p-10 lg:p-16 w-full relative overflow-hidden"
                            style={{ boxShadow: `0 30px 60px -15px ${primaryColor}30, inset 0 2px 4px rgba(255,255,255,0.8)` }}
                        >
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center w-full relative z-10">

                                {/* Left side - Content */}
                                <div className="flex flex-col justify-center order-2 lg:order-1 min-w-0 pb-20 lg:pb-0">
                                    <div className="mb-6 lg:mb-8">
                                        <h1 className="display text-4xl sm:text-5xl md:text-6xl font-black mb-3 leading-tight animate-fade-in break-words tracking-tight drop-shadow-sm" style={{ color: darkColor }}>
                                            {product.name}
                                        </h1>
                                        <p className="heading text-base sm:text-lg md:text-xl font-extrabold animate-fade-in break-words tracking-widest uppercase opacity-90" style={{ color: darkColor, animationDelay: '0.1s' }}>
                                            {product.brand} {product.subBrand}
                                        </p>
                                    </div>

                                    <p className="body text-base sm:text-lg md:text-xl font-medium text-slate-600 mb-6 lg:mb-8 leading-relaxed animate-fade-in break-words" style={{ animationDelay: '0.2s' }}>
                                        {product.description}
                                    </p>

                                    {product.benefits?.length > 0 && (
                                        <ul className="space-y-3 lg:space-y-4 mb-8 lg:mb-10 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                                            {product.benefits.map((benefit, idx) => (
                                                <li key={idx} className="flex items-start gap-3 min-w-0">
                                                    <span
                                                        className="w-2.5 h-2.5 rounded-full mt-2 flex-shrink-0 animate-pulse shadow-sm"
                                                        style={{ backgroundColor: primaryColor }}
                                                    />
                                                    <span className="body font-medium text-base sm:text-lg break-words" style={{ color: darkColor }}>{benefit}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}

                                    {/* Price badge and Buttons Container */}
                                    <div className="flex flex-wrap items-center gap-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
                                        <div
                                            className="inline-flex flex-col items-center justify-center px-8 lg:px-10 py-5 lg:py-6 rounded-[2rem] w-fit transform hover:scale-105 transition-all duration-300 backdrop-blur-2xl bg-white/80"
                                            style={{
                                                boxShadow: `0 20px 40px ${primaryColor}20, inset 0 2px 15px rgba(255,255,255,0.8)`,
                                                border: `2px solid ${primaryColor}50`
                                            }}
                                        >
                                            <span className="heading text-xs lg:text-sm uppercase tracking-widest font-extrabold mb-1" style={{ color: darkColor }}>
                                                A sólo
                                            </span>
                                            <span className="display text-3xl lg:text-4xl font-black drop-shadow-sm" style={{ color: darkColor }}>
                                                ${product.price.toFixed(2)}
                                            </span>
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            <Button
                                                onClick={handleDirectCheckout}
                                                className="rounded-full px-8 py-6 bg-slate-900 hover:bg-black text-white shadow-xl hover:shadow-slate-500/30 transition-all font-bold tracking-wide uppercase text-sm"
                                            >
                                                Comprar ahora
                                            </Button>
                                            <div className="flex items-center gap-3">
                                                <Button
                                                    onClick={(e) => {
                                                        onBuy(product);
                                                        // Local "dance" trigger
                                                        const btn = e.currentTarget;
                                                        btn.classList.add('animate-bounce');
                                                        setTimeout(() => btn.classList.remove('animate-bounce'), 800);
                                                    }}
                                                    className="rounded-full w-14 h-14 md:w-16 md:h-16 p-0 flex items-center justify-center bg-primary hover:bg-primary/90 text-white shadow-xl hover:shadow-primary/40 transition-all group/buy"
                                                    title="Añadir al carrito"
                                                >
                                                    <ShoppingBag className="w-8 h-8 group-hover/buy:-rotate-12 transition-transform" />
                                                </Button>
                                                <Button
                                                    onClick={onToggleLike}
                                                    variant="outline"
                                                    className="rounded-full px-8 py-6 border-primary/20 bg-white/50 hover:bg-red-50 transition-all flex items-center justify-center gap-2 group/like h-14 md:h-16"
                                                >
                                                    <Heart className={`w-5 h-5 transition-transform group-hover/like:scale-110 ${isLiked ? 'fill-red-500 text-red-500' : 'text-primary'}`} />
                                                    <span className={`font-semibold heading ${isLiked ? 'text-red-500' : 'text-primary'}`}>
                                                        {isLiked ? 'Me encanta' : 'Me encanta'}
                                                    </span>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right side - Image with elaborate decorative elements */}
                                <div className="relative flex items-center justify-center order-1 lg:order-2 mb-8 lg:mb-0 min-h-[300px] sm:min-h-[400px] lg:min-h-[600px] mt-6 lg:mt-0">
                                    {/* Large animated blob background */}
                                    <div
                                        className="absolute w-56 h-56 sm:w-80 sm:h-80 md:w-96 md:h-96 lg:w-[500px] lg:h-[500px] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] opacity-20 blur-2xl animate-spin-slow"
                                        style={{ backgroundColor: primaryColor, mixBlendMode: 'multiply' }}
                                    />

                                    {/* Second blob for depth */}
                                    <div
                                        className="absolute w-56 h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 lg:w-[450px] lg:h-[450px] rounded-[60%_40%_30%_70%/50%_40%_50%_60%] opacity-30 blur-xl animate-spin-slow"
                                        style={{ backgroundColor: primaryColor, animationDirection: 'reverse', animationDuration: '25s' }}
                                    />

                                    {/* Image container with glow and rounded borders */}
                                    <div className="relative z-10 w-48 h-48 sm:w-72 sm:h-72 md:w-80 md:h-80 lg:w-[400px] lg:h-[400px] rounded-[45%] p-2 sm:p-3 lg:p-4 backdrop-blur-2xl bg-white/60 border border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.15),inset_0_2px_20px_rgba(255,255,255,0.8)] animate-float">
                                        <div
                                            className="absolute inset-0 rounded-[45%] opacity-50 blur-xl transition-colors duration-1000 mix-blend-multiply"
                                            style={{ backgroundColor: primaryColor }}
                                        />
                                        <img
                                            src={product.imageUrl}
                                            alt={product.name}
                                            className="relative z-20 w-full h-full object-cover rounded-[45%] drop-shadow-2xl transition-transform duration-700 hover:scale-[1.08]"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400?text=Natura';
                                            }}
                                        />
                                    </div>

                                    {/* Decorative floating dots around image */}
                                    <div
                                        className="absolute top-10 right-10 w-4 h-4 rounded-full animate-bounce"
                                        style={{ backgroundColor: analogousColor1, animationDelay: '0.2s', opacity: 0.8 }}
                                    />
                                    <div
                                        className="absolute bottom-20 left-10 w-6 h-6 rounded-full animate-bounce"
                                        style={{ backgroundColor: analogousColor2, animationDelay: '0.7s', opacity: 0.6 }}
                                    />
                                    <div
                                        className="absolute top-1/2 -right-4 w-3 h-3 rounded-full animate-pulse"
                                        style={{ backgroundColor: primaryColor, animationDelay: '1.2s', opacity: 0.5 }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom decorative wave */}
                    <div className="absolute bottom-0 left-0 w-full h-24 sm:h-32 md:h-40 pointer-events-none opacity-20">
                        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-full">
                            <path
                                d="M 0,60 Q 300,20 600,60 T 1200,60 L 1200,120 L 0,120 Z"
                                fill={analogousColor1}
                                className="animate-pulse"
                                opacity="0.6"
                            />
                            <path
                                d="M 0,90 Q 400,10 800,90 T 1200,80 L 1200,120 L 0,120 Z"
                                fill={analogousColor2}
                                className="animate-pulse"
                                style={{ animationDelay: '2s' }}
                            />
                        </svg>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
