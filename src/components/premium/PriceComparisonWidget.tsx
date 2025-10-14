'use client';

import { useState } from 'react';

interface PriceComparison {
  retailer: string;
  price: number;
  originalPrice?: number;
  inStock: boolean;
  shippingCost: number;
  totalCost: number;
  url: string;
}

export default function PriceComparisonWidget() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PriceComparison[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);

    // Simulate API call - replace with actual price comparison API
    setTimeout(() => {
      const mockResults: PriceComparison[] = [
        {
          retailer: 'Olive Young Global',
          price: 28.50,
          originalPrice: 35.00,
          inStock: true,
          shippingCost: 12.99,
          totalCost: 41.49,
          url: 'https://global.oliveyoung.com/product/123'
        },
        {
          retailer: 'YesStyle',
          price: 32.90,
          inStock: true,
          shippingCost: 7.99,
          totalCost: 40.89,
          url: 'https://yesstyle.com/product/456'
        },
        {
          retailer: 'StyleKorean',
          price: 29.99,
          inStock: true,
          shippingCost: 6.99,
          totalCost: 36.98,
          url: 'https://stylekorean.com/product/789'
        },
        {
          retailer: 'Sephora',
          price: 45.00,
          inStock: false,
          shippingCost: 5.95,
          totalCost: 50.95,
          url: 'https://sephora.com/product/abc'
        },
        {
          retailer: 'Amazon',
          price: 38.99,
          inStock: true,
          shippingCost: 0,
          totalCost: 38.99,
          url: 'https://amazon.com/product/def'
        }
      ];

      setSearchResults(mockResults.sort((a, b) => a.totalCost - b.totalCost));
      setIsSearching(false);
    }, 2000);
  };

  return (
    <div className="bg-luxury-black-soft border border-luxury-gold border-opacity-20 p-8">
      <div className="mb-8">
        <p className="text-luxury-gold text-xs uppercase tracking-wider mb-2">REAL-TIME PRICING</p>
        <h3 className="text-2xl font-light text-white mb-4">Price Comparison Engine</h3>
        <p className="text-luxury-gray">
          Compare prices across 8+ major K-beauty retailers instantly
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <div className="flex gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for any Korean beauty product..."
            className="flex-1 bg-transparent border border-luxury-gold border-opacity-30 text-white px-4 py-3 focus:border-luxury-gold focus:outline-none"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={!searchQuery.trim() || isSearching}
            className="bg-luxury-gold text-black px-8 py-3 text-sm uppercase tracking-wider font-medium hover:bg-opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? 'SEARCHING...' : 'COMPARE PRICES'}
          </button>
        </div>
      </div>

      {isSearching && (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-2 border-luxury-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-luxury-gray">Checking prices across all retailers...</p>
        </div>
      )}

      {searchResults.length > 0 && !isSearching && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-white font-light text-lg">
              Results for "{searchQuery}"
            </h4>
            <div className="text-right">
              <p className="text-luxury-gold text-sm">
                Best Deal: ${Math.min(...searchResults.filter(r => r.inStock).map(r => r.totalCost)).toFixed(2)}
              </p>
              <p className="text-luxury-gray text-xs">
                Savings vs highest: ${(Math.max(...searchResults.map(r => r.totalCost)) - Math.min(...searchResults.filter(r => r.inStock).map(r => r.totalCost))).toFixed(2)}
              </p>
            </div>
          </div>

          {searchResults.map((result, index) => (
            <div
              key={index}
              className={`border p-6 transition-all duration-300 ${
                index === 0 && result.inStock
                  ? 'border-luxury-gold bg-luxury-gold bg-opacity-5'
                  : 'border-luxury-gold border-opacity-10 hover:border-opacity-30'
              } ${!result.inStock ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-luxury-gold bg-opacity-10 rounded flex items-center justify-center">
                    <span className="text-luxury-gold text-lg">🏪</span>
                  </div>
                  <div>
                    <h5 className="text-white font-light text-lg">
                      {result.retailer}
                      {index === 0 && result.inStock && (
                        <span className="ml-3 bg-luxury-gold text-black px-2 py-1 text-xs uppercase tracking-wider font-medium">
                          BEST DEAL
                        </span>
                      )}
                    </h5>
                    <p className={`text-sm ${result.inStock ? 'text-luxury-gold' : 'text-red-400'}`}>
                      {result.inStock ? '✓ In Stock' : '✗ Out of Stock'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-4 mb-2">
                    <div>
                      <p className="text-luxury-gray text-xs uppercase tracking-wider">PRODUCT PRICE</p>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-lg font-light">
                          ${result.price.toFixed(2)}
                        </span>
                        {result.originalPrice && result.originalPrice > result.price && (
                          <span className="text-luxury-gray text-sm line-through">
                            ${result.originalPrice.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-luxury-gray text-xs uppercase tracking-wider">SHIPPING</p>
                      <p className="text-white text-lg font-light">
                        {result.shippingCost === 0 ? 'FREE' : `$${result.shippingCost.toFixed(2)}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-luxury-gray text-xs uppercase tracking-wider">TOTAL COST</p>
                      <p className="text-luxury-gold text-lg font-light">
                        ${result.totalCost.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <button
                    disabled={!result.inStock}
                    className="text-luxury-gold text-sm uppercase tracking-wider hover:text-white transition-colors duration-300 border border-luxury-gold border-opacity-30 px-4 py-2 hover:border-opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    VIEW PRODUCT →
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="mt-8 p-6 border border-luxury-gold border-opacity-20 bg-luxury-black">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-luxury-gold text-xl font-light">
                  {searchResults.filter(r => r.inStock).length}/{searchResults.length}
                </div>
                <p className="text-luxury-gray text-xs uppercase tracking-wider">
                  RETAILERS IN STOCK
                </p>
              </div>
              <div>
                <div className="text-luxury-gold text-xl font-light">
                  ${(Math.max(...searchResults.map(r => r.totalCost)) - Math.min(...searchResults.filter(r => r.inStock).map(r => r.totalCost))).toFixed(2)}
                </div>
                <p className="text-luxury-gray text-xs uppercase tracking-wider">
                  PRICE DIFFERENCE
                </p>
              </div>
              <div>
                <div className="text-luxury-gold text-xl font-light">
                  {Math.round((1 - Math.min(...searchResults.filter(r => r.inStock).map(r => r.totalCost)) / Math.max(...searchResults.map(r => r.totalCost))) * 100)}%
                </div>
                <p className="text-luxury-gray text-xs uppercase tracking-wider">
                  MAX SAVINGS
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {searchResults.length === 0 && !isSearching && (
        <div className="text-center py-16">
          <div className="text-6xl mb-6">🔍</div>
          <h4 className="text-white text-xl font-light mb-4">
            Instant Price Intelligence
          </h4>
          <p className="text-luxury-gray mb-8 max-w-md mx-auto">
            Search for any Korean beauty product to see real-time pricing
            across all major retailers. Save up to 70% by finding the best deals.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-2xl mb-2">⚡</div>
              <p className="text-luxury-gray text-sm">
                Real-time pricing from 8+ retailers
              </p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">📊</div>
              <p className="text-luxury-gray text-sm">
                Includes shipping costs for true comparison
              </p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">💎</div>
              <p className="text-luxury-gray text-sm">
                Premium member exclusive feature
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}