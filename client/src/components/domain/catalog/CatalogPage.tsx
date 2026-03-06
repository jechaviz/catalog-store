import { useColorExtraction, getLighterShade } from '@/hooks/useColorExtraction';

interface CatalogPageProps {
  name: string;
  brand: string;
  subBrand: string;
  description: string;
  benefits: string[];
  price: number;
  imageUrl: string;
}

export function CatalogPage({
  name,
  brand,
  subBrand,
  description,
  benefits,
  price,
  imageUrl,
}: CatalogPageProps) {
  const colorData = useColorExtraction(imageUrl);
  const primaryColor = colorData?.hex || '#C1440E';
  const lightColor = getLighterShade(primaryColor, 35);

  return (
    <div className="w-full min-h-screen bg-white relative overflow-hidden flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12">
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
      <div className="relative z-10 w-full max-w-6xl mx-auto xl:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left side - Content */}
          <div className="flex flex-col justify-center order-2 lg:order-1 min-w-0">
            <div className="mb-6 lg:mb-8">
              <h1
                className="display text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-extrabold mb-2 leading-tight animate-fade-in break-words text-foreground drop-shadow-sm"
              >
                {name}
              </h1>
              <p
                className="heading text-sm sm:text-base md:text-lg font-bold animate-fade-in break-words tracking-wide uppercase"
                style={{ color: primaryColor, animationDelay: '0.1s' }}
              >
                {brand} {subBrand}
              </p>
            </div>

            <p className="body text-sm sm:text-base md:text-lg text-foreground/80 mb-6 lg:mb-8 leading-relaxed animate-fade-in break-words" style={{ animationDelay: '0.2s' }}>
              {description}
            </p>

            {benefits.length > 0 && (
              <ul className="space-y-3 lg:space-y-4 mb-8 lg:mb-10 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                {benefits.map((benefit, idx) => (
                  <li key={idx} className="flex items-start gap-3 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full mt-2 flex-shrink-0 animate-pulse"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <span className="body text-sm sm:text-base text-foreground/80 break-words">{benefit}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Price badge with animation */}
            <div
              className="inline-flex flex-col items-center justify-center px-8 lg:px-10 py-5 lg:py-6 rounded-[2rem] shadow-xl w-fit transform hover:scale-105 transition-transform duration-300 animate-fade-in"
              style={{
                backgroundColor: lightColor,
                boxShadow: `0 20px 40px ${primaryColor}25, inset 0 2px 10px rgba(255,255,255,0.5)`,
                animationDelay: '0.4s'
              }}
            >
              <span className="heading text-sm uppercase tracking-widest font-bold mb-1" style={{ color: primaryColor }}>
                A sólo
              </span>
              <span className="display text-4xl lg:text-5xl font-black drop-shadow-sm" style={{ color: primaryColor }}>
                ${price.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Right side - Image with elaborate decorative elements */}
          <div className="relative flex items-center justify-center order-1 lg:order-2 mb-8 lg:mb-0 min-h-[300px] sm:min-h-[400px] lg:min-h-[500px]">
            {/* Large animated blob background */}
            <div
              className="absolute w-56 h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 lg:w-[450px] lg:h-[450px] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] opacity-20 blur-xl animate-spin-slow"
              style={{ backgroundColor: primaryColor, mixBlendMode: 'multiply' }}
            />

            {/* Decorative organic shape behind image */}
            <svg
              className="absolute w-64 h-64 sm:w-80 sm:h-80 lg:w-[500px] lg:h-[500px] opacity-15 animate-float"
              viewBox="0 0 300 300"
              preserveAspectRatio="xMidYMid meet"
              style={{ animationDelay: '1s' }}
            >
              <path
                d="M 150,40 Q 240,80 260,170 Q 240,260 150,280 Q 60,260 40,170 Q 60,80 150,40 Z"
                fill={primaryColor}
                opacity="0.4"
              />
            </svg>

            {/* Product image with glow */}
            <div className="relative z-10 w-48 h-48 sm:w-64 sm:h-64 lg:w-80 lg:h-80 rounded-[45%] p-2 bg-white/30 backdrop-blur-sm shadow-2xl animate-float">
              <img
                src={imageUrl}
                alt={name}
                className="w-full h-full object-cover rounded-[45%]"
                style={{
                  boxShadow: `inset 0 0 40px ${primaryColor}30`,
                }}
              />
            </div>

            {/* Decorative floating elements around image */}
            <div
              className="absolute -top-10 -left-10 lg:-top-16 lg:-left-16 w-24 h-24 lg:w-36 lg:h-36 opacity-30 animate-spin-slow"
              style={{
                background: `radial-gradient(circle, ${primaryColor}, transparent)`,
                borderRadius: '50%',
                filter: 'blur(20px)',
              }}
            />

            <div
              className="absolute -bottom-8 -right-8 lg:-bottom-12 lg:-right-12 w-20 h-20 lg:w-32 lg:h-32 opacity-25 animate-bounce-slow"
              style={{
                background: `radial-gradient(circle, ${primaryColor}, transparent)`,
                borderRadius: '50%',
                filter: 'blur(15px)',
              }}
            />

            {/* Decorative curved lines */}
            <svg
              className="absolute w-full h-full opacity-30 pointer-events-none"
              viewBox="0 0 400 400"
              preserveAspectRatio="xMidYMid meet"
            >
              <path
                d="M 200,50 Q 300,150 200,300"
                stroke={primaryColor}
                strokeWidth="1.5"
                fill="none"
                opacity="0.5"
                strokeLinecap="round"
                strokeDasharray="4 8"
                className="animate-pulse"
              />
              <path
                d="M 100,150 Q 200,200 150,300"
                stroke={primaryColor}
                strokeWidth="1"
                fill="none"
                opacity="0.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Bottom decorative wave */}
      <svg
        className="absolute bottom-0 left-0 w-full opacity-25 pointer-events-none"
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        height="120"
      >
        <path
          d="M 0,60 Q 300,20 600,60 T 1200,60 L 1200,120 L 0,120 Z"
          fill={primaryColor}
        />
      </svg>

      {/* Styles for animations */}
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-15px);
          }
        }

        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-12px);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
          opacity: 0;
        }

        .animate-float {
          animation: float 5s ease-in-out infinite;
        }

        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }

        .animate-bounce-slow {
          animation: bounce-slow 3.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
