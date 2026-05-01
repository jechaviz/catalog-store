import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'wouter';

export type Brand = 'natura' | 'nikken';

interface BrandContextType {
  brand: Brand;
  isNatura: boolean;
  isNikken: boolean;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [brand, setBrand] = useState<Brand>('natura');

  useEffect(() => {
    if (location.startsWith('/nikken')) {
      setBrand('nikken');
    } else {
      setBrand('natura');
    }
  }, [location]);

  const value = {
    brand,
    isNatura: brand === 'natura',
    isNikken: brand === 'nikken',
  };

  return (
    <BrandContext.Provider value={value}>
      <div className={brand === 'nikken' ? 'theme-nikken' : ''}>
        {children}
      </div>
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
}
