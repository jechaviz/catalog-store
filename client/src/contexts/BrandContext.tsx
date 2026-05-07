import React, { createContext, useContext } from 'react';

export type Brand = 'natura' | 'nikken';

interface BrandContextType {
  brand: Brand;
  isNatura: boolean;
  isNikken: boolean;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const value: BrandContextType = {
    brand: 'natura',
    isNatura: true,
    isNikken: false,
  };

  return (
    <BrandContext.Provider value={value}>
      <div>{children}</div>
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
