import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Heart, ShoppingBag, X } from 'lucide-react';
import { useColorExtraction, getLighterShade } from '@/hooks/useColorExtraction';
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
    const colorData = useColorExtraction(product?.imageUrl || '');
    const primaryColor = colorData?.hex || '#F97316';
    const lightColor = getLighterShade(primaryColor, 35);

    if (!product) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent showCloseButton={false} className="max-w-none sm:max-w-none md:max-w-none lg:max-w-none w-screen h-[100dvh] m-0 p-0 rounded-none border-none bg-background shadow-none overflow-y-auto overflow-x-hidden">
                <div className="w-full min-h-[100dvh] relative flex flex-col items-center p-4 sm:p-6 md:p-8 lg:p-12 overflow-x-hidden">

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="fixed top-6 right-6 z-50 p-3 bg-white/50 backdrop-blur-md hover:bg-white/80 transition-colors rounded-full shadow-lg"
                    >
                        <X className="w-6 h-6 text-foreground" />
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
                            fill={primaryColor}
                            opacity="0.18"
                            filter="url(#blur-heavy)"
                            className="animate-pulse"
                        />

                        {/* Medium blob bottom left */}
                        <path
                            d="M 50,550 Q 30,650 100,720 Q 200,780 300,700 Q 350,620 280,550 Q 150,480 50,550 Z"
                            fill={primaryColor}
                            opacity="0.15"
                            filter="url(#blur-heavy)"
                            className="animate-pulse"
                            style={{ animationDelay: '1.5s' }}
                        />

                        {/* Curved line top */}
                        <path
                            d="M 0,0 Q 300,80 600,20 T 1200,0"
                            stroke={primaryColor}
                            strokeWidth="2"
                            fill="none"
                            opacity="0.25"
                            strokeLinecap="round"
                        />

                        {/* Decorative curves */}
                        <path
                            d="M 1000,0 Q 1100,150 1050,300"
                            stroke={primaryColor}
                            strokeWidth="3"
                            fill="none"
                            opacity="0.2"
                            strokeLinecap="round"
                            className="animate-pulse"
                        />
                    </svg>

                    {/* Decorative dots pattern - animated */}
                    <div className="absolute top-4 right-4 sm:top-8 sm:right-8 md:top-12 md:right-12 space-y-2 sm:space-y-3 z-20">
                        {[...Array(5)].map((_, row) => (
                            <div key={row} className="flex gap-2 sm:gap-3">
                                {[...Array(4)].map((_, col) => (
                                    <div
                                        key={col}
                                        className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full animate-bounce"
                                        style={{
                                            backgroundColor: primaryColor,
                                            opacity: 0.4,
                                            animationDelay: `${(row + col) * 0.15}s`,
                                        }}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* Decorative ingredients/shapes - top left */}
                    <div className="absolute top-0 left-0 w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 opacity-30 pointer-events-none">
                        <svg viewBox="0 0 200 200" className="w-full h-full animate-float">
                            <ellipse cx="40" cy="40" rx="20" ry="30" fill={primaryColor} opacity="0.6" transform="rotate(-30 40 40)" />
                            <ellipse cx="80" cy="30" rx="18" ry="28" fill={primaryColor} opacity="0.5" transform="rotate(20 80 30)" />
                            <circle cx="50" cy="80" r="15" fill={primaryColor} opacity="0.4" />
                        </svg>
                    </div>

                    {/* Decorative ingredients/shapes - bottom right */}
                    <div className="absolute bottom-0 right-0 w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 opacity-25 pointer-events-none">
                        <svg viewBox="0 0 200 200" className="w-full h-full animate-float" style={{ animationDelay: '0.5s' }}>
                            <circle cx="150" cy="150" r="25" fill={primaryColor} opacity="0.5" />
                            <circle cx="100" cy="170" r="20" fill={primaryColor} opacity="0.4" />
                            <path d="M 170,100 Q 180,120 170,140 Q 160,130 170,100" fill={primaryColor} opacity="0.3" />
                        </svg>
                    </div>

                    {/* Main content grid */}
                    <div className="relative z-10 w-full max-w-6xl mx-auto xl:px-8 mt-16 md:mt-12 flex-1 flex items-center">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center w-full">

                            {/* Left side - Content */}
                            <div className="flex flex-col justify-center order-2 lg:order-1 min-w-0 pb-20 lg:pb-0">
                                <div className="mb-6 lg:mb-8">
                                    <h1 className="display text-4xl sm:text-5xl md:text-6xl font-extrabold mb-2 leading-tight animate-fade-in break-words text-foreground drop-shadow-sm">
                                        {product.name}
                                    </h1>
                                    <p className="heading text-base sm:text-lg md:text-xl font-bold animate-fade-in break-words tracking-wide uppercase" style={{ color: primaryColor, animationDelay: '0.1s' }}>
                                        {product.brand} {product.subBrand}
                                    </p>
                                </div>

                                <p className="body text-base sm:text-lg md:text-xl text-foreground/80 mb-6 lg:mb-8 leading-relaxed animate-fade-in break-words" style={{ animationDelay: '0.2s' }}>
                                    {product.description}
                                </p>

                                {product.benefits?.length > 0 && (
                                    <ul className="space-y-3 lg:space-y-4 mb-8 lg:mb-10 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                                        {product.benefits.map((benefit, idx) => (
                                            <li key={idx} className="flex items-start gap-3 min-w-0">
                                                <span
                                                    className="w-2.5 h-2.5 rounded-full mt-2 flex-shrink-0 animate-pulse"
                                                    style={{ backgroundColor: primaryColor }}
                                                />
                                                <span className="body text-base sm:text-lg text-foreground/80 break-words">{benefit}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {/* Price badge and Buttons Container */}
                                <div className="flex flex-wrap items-center gap-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
                                    <div
                                        className="inline-flex flex-col items-center justify-center px-8 lg:px-10 py-5 lg:py-6 rounded-[2rem] shadow-xl w-fit transform hover:scale-105 transition-transform duration-300"
                                        style={{
                                            backgroundColor: lightColor,
                                            boxShadow: `0 20px 40px ${primaryColor}25, inset 0 2px 10px rgba(255,255,255,0.5)`,
                                        }}
                                    >
                                        <span className="heading text-xs lg:text-sm uppercase tracking-widest font-bold mb-1" style={{ color: primaryColor }}>
                                            A sólo
                                        </span>
                                        <span className="display text-3xl lg:text-4xl font-black drop-shadow-sm" style={{ color: primaryColor }}>
                                            ${product.price.toFixed(2)}
                                        </span>
                                    </div>

                                    <div className="flex flex-col gap-3">
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
                                            className="rounded-full px-8 py-6 border-primary/20 bg-white/50 hover:bg-red-50 transition-all flex items-center justify-center gap-2 group/like"
                                        >
                                            <Heart className={`w-5 h-5 transition-transform group-hover/like:scale-110 ${isLiked ? 'fill-red-500 text-red-500' : 'text-primary'}`} />
                                            <span className={`font-semibold heading ${isLiked ? 'text-red-500' : 'text-primary'}`}>
                                                {isLiked ? 'En tus favoritos' : 'Me encanta'}
                                            </span>
                                        </Button>
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
                                <div className="relative z-10 w-48 h-48 sm:w-72 sm:h-72 md:w-80 md:h-80 lg:w-[400px] lg:h-[400px] rounded-[45%] p-2 sm:p-3 lg:p-4 backdrop-blur-md bg-white/40 shadow-2xl animate-float">
                                    <div
                                        className="absolute inset-0 rounded-[45%] opacity-50 blur-lg transition-colors duration-1000"
                                        style={{ backgroundColor: primaryColor }}
                                    />
                                    <img
                                        src={product.imageUrl}
                                        alt={product.name}
                                        className="relative z-20 w-full h-full object-cover rounded-[45%] shadow-[inset_0_0_20px_rgba(0,0,0,0.1)] transition-transform duration-700 hover:scale-105"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400?text=Natura';
                                        }}
                                    />
                                </div>

                                {/* Decorative floating dots around image */}
                                <div
                                    className="absolute top-10 right-10 w-4 h-4 rounded-full animate-bounce"
                                    style={{ backgroundColor: primaryColor, animationDelay: '0.2s' }}
                                />
                                <div
                                    className="absolute bottom-20 left-10 w-6 h-6 rounded-full animate-bounce"
                                    style={{ backgroundColor: primaryColor, animationDelay: '0.7s', opacity: 0.6 }}
                                />
                            </div>
                        </div>

                    </div>

                    {/* Bottom decorative wave */}
                    <div className="absolute bottom-0 left-0 w-full h-24 sm:h-32 md:h-40 pointer-events-none opacity-20">
                        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-full">
                            <path
                                d="M 0,60 Q 300,20 600,60 T 1200,60 L 1200,120 L 0,120 Z"
                                fill={primaryColor}
                                className="animate-pulse"
                            />
                        </svg>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
