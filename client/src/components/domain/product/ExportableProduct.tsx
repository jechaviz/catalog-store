import type { CatalogProduct } from '@/lib/dataFetcher';
import { useColorExtraction, getLighterShade, getDarkerShade } from '@/hooks/useColorExtraction';

export type ExportImageType = 'post' | 'story';

export function getExportElementId(productId: string, type: ExportImageType) {
  return `product-export-${productId}-${type}`;
}

interface ExportableProductProps {
  product: CatalogProduct;
  type: ExportImageType;
  primaryColor?: string;
}

export function ExportableProduct({ product, type, primaryColor }: ExportableProductProps) {
  const colorData = useColorExtraction(primaryColor ? null : product.imageUrl);
  const accentColor = primaryColor || colorData?.hex || '#C1440E';
  const lightColor = getLighterShade(accentColor, 35);
  const darkColor = getDarkerShade(accentColor, 45);
  const brandLabel = [product.brand, product.subBrand].filter(Boolean).join(' ');

  const containerStyle = type === 'post'
    ? { width: '1080px', height: '1080px' }
    : { width: '1080px', height: '1920px' };

  return (
    <div
      id={getExportElementId(product.id, type)}
      aria-hidden="true"
      style={{
        ...containerStyle,
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        left: '-5000px',
        top: '0',
        zIndex: -100,
        overflow: 'hidden',
        padding: type === 'story' ? '120px 80px' : '80px',
        fontFamily: "'Playfair Display', serif",
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-200px',
          right: '-200px',
          width: '800px',
          height: '800px',
          backgroundColor: accentColor,
          opacity: 0.08,
          borderRadius: '50%',
          filter: 'blur(100px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-150px',
          left: '-150px',
          width: '600px',
          height: '600px',
          backgroundColor: accentColor,
          opacity: 0.1,
          borderRadius: '50%',
          filter: 'blur(80px)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: '80px',
          left: '80px',
          fontSize: '42px',
          fontWeight: 900,
          color: accentColor,
          letterSpacing: '8px',
          textTransform: 'uppercase',
        }}
      >
        {product.brand}
      </div>

      <div
        style={{
          width: type === 'story' ? '800px' : '650px',
          height: type === 'story' ? '800px' : '650px',
          borderRadius: '50%',
          backgroundColor: `${accentColor}10`,
          padding: '20px',
          marginBottom: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 40px 100px ${accentColor}15`,
          border: '12px solid white',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <img
          src={product.imageUrl}
          alt={product.name}
          style={{
            width: '90%',
            height: '90%',
            objectFit: 'contain',
            borderRadius: '45%',
          }}
        />
      </div>

      <div style={{ textAlign: 'center', maxWidth: '900px', zIndex: 10 }}>
        <p
          style={{
            fontSize: '32px',
            fontWeight: 800,
            color: accentColor,
            letterSpacing: '6px',
            textTransform: 'uppercase',
            marginBottom: '20px',
          }}
        >
          {brandLabel}
        </p>
        <h1
          style={{
            fontSize: type === 'story' ? '82px' : '72px',
            fontWeight: 900,
            color: '#111',
            lineHeight: 1.1,
            marginBottom: '40px',
            padding: '0 40px',
          }}
        >
          {product.name}
        </h1>

        <div
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: lightColor,
            padding: '40px 80px',
            borderRadius: '80px',
            boxShadow: `0 30px 60px ${accentColor}20`,
          }}
        >
          <span
            style={{
              fontSize: '24px',
              fontWeight: 800,
              color: darkColor,
              letterSpacing: '4px',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            A solo
          </span>
          <span style={{ fontSize: '84px', fontWeight: 900, color: darkColor }}>
            ${product.price.toFixed(2)}
          </span>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '80px',
          fontSize: '24px',
          fontWeight: 600,
          color: '#888',
          letterSpacing: '2px',
        }}
      >
        {product.brand} catalogo digital
      </div>
    </div>
  );
}
