'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink, TrendingDown, Clock, Star, Shield } from 'lucide-react';
import AuthenticityGuide from './AuthenticityGuide';

interface DealDetailModalProps {
  deal: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function DealDetailModal({ deal, isOpen, onClose }: DealDetailModalProps) {
  const [priceComparisons, setPriceComparisons] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuthenticityGuide, setShowAuthenticityGuide] = useState(false);

  useEffect(() => {
    if (isOpen && deal?.product_id) {
      loadPriceComparison();
    }
  }, [isOpen, deal?.product_id]);

  const loadPriceComparison = async () => {
    if (!deal?.product_id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/price-intelligence/product-comparison?productId=${deal.product_id}`);
      const data = await response.json();

      if (data.success) {
        setPriceComparisons(data.priceComparisons || []);
        setAnalytics(data.analytics || null);
      } else {
        setError(data.error || 'Failed to load price comparison');
        console.error('Price comparison API error:', data.error);
      }
    } catch (err) {
      console.error('Error loading price comparison:', err);
      setError('Failed to load price comparison data');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !deal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-auto bg-black border border-luxury-gold border-opacity-30 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-black border-b border-luxury-gold border-opacity-20 p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-luxury-gold text-black px-3 py-1 text-xs uppercase tracking-wider font-medium">
                  {deal.deal_type?.replace('_', ' ')}
                </span>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-luxury-gold" />
                  <span className="text-luxury-gold text-sm font-medium">
                    Deal Score: {deal.deal_score}/100
                  </span>
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl font-light text-white mb-2">
                {deal.product?.name || 'Korean Beauty Product'}
              </h2>
              <p className="text-luxury-gray text-lg">
                {deal.product?.brand || 'K-Beauty'} • {deal.product?.category || 'Skincare'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-luxury-gray hover:text-white transition-colors duration-300 p-2"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Deal Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="text-center p-6 border border-luxury-gold border-opacity-20 bg-luxury-black-soft">
              <div className="text-3xl font-light text-luxury-gold mb-2">
                ${deal.current_price?.toFixed(2)}
              </div>
              <p className="text-luxury-gray text-sm uppercase tracking-wider">CURRENT PRICE</p>
              {deal.previous_price && (
                <p className="text-luxury-gray text-sm mt-1">
                  was <span className="line-through">${deal.previous_price.toFixed(2)}</span>
                </p>
              )}
            </div>
            <div className="text-center p-6 border border-luxury-gold border-opacity-20 bg-luxury-black-soft">
              <div className="text-3xl font-light text-luxury-gold mb-2">
                ${deal.savings_amount?.toFixed(2)}
              </div>
              <p className="text-luxury-gray text-sm uppercase tracking-wider">YOU SAVE</p>
              <p className="text-luxury-gold text-sm mt-1">
                {deal.savings_percentage?.toFixed(0)}% off
              </p>
            </div>
            <div className="text-center p-6 border border-luxury-gold border-opacity-20 bg-luxury-black-soft">
              <div className="flex items-center justify-center gap-2 text-luxury-gold mb-2">
                <Clock size={20} />
                <span className="text-lg font-light">Limited Time</span>
              </div>
              <p className="text-luxury-gray text-sm uppercase tracking-wider">EXCLUSIVE DEAL</p>
            </div>
          </div>

          {/* Price Comparison */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <TrendingDown className="text-luxury-gold" size={24} />
                <h3 className="text-xl font-light text-white">Live Price Comparison</h3>
              </div>
              <button
                onClick={() => setShowAuthenticityGuide(true)}
                className="flex items-center gap-2 text-luxury-gold text-sm uppercase tracking-wider hover:text-white transition-colors duration-300 border border-luxury-gold border-opacity-30 px-3 py-2 hover:border-opacity-100"
              >
                <Shield size={16} />
                AUTHENTICITY GUIDE
              </button>
            </div>

            {loading && (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-2 border-luxury-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-luxury-gray text-sm">Loading live prices...</p>
              </div>
            )}

            {error && (
              <div className="text-center py-8">
                <p className="text-red-400 text-sm mb-4">{error}</p>
                <button
                  onClick={loadPriceComparison}
                  className="text-luxury-gold text-sm uppercase tracking-wider hover:text-white transition-colors"
                >
                  RETRY
                </button>
              </div>
            )}

            {!loading && !error && priceComparisons.length === 0 && (
              <div className="text-center py-8">
                <p className="text-luxury-gray text-sm">No price data available for this product.</p>
              </div>
            )}

            <div className="space-y-4">
              {!loading && priceComparisons.map((comparison, index) => (
                <div
                  key={index}
                  className={`border p-6 transition-all duration-300 ${
                    comparison.isBestDeal
                      ? 'border-luxury-gold bg-luxury-gold bg-opacity-5'
                      : 'border-luxury-gold border-opacity-10 hover:border-opacity-30'
                  } ${!comparison.inStock ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-luxury-gold bg-opacity-10 rounded flex items-center justify-center">
                        <span className="text-luxury-gold text-lg">🏪</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-white font-light text-lg">
                            {comparison.retailer}
                          </h4>
                          {comparison.authenticity && (
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{comparison.authenticity.icon}</span>
                              <span
                                className="px-2 py-1 text-xs uppercase tracking-wider font-medium rounded"
                                style={{
                                  backgroundColor: `${comparison.authenticity.riskColor}20`,
                                  color: comparison.authenticity.riskColor,
                                  border: `1px solid ${comparison.authenticity.riskColor}40`
                                }}
                              >
                                {comparison.authenticity.riskLevel}
                              </span>
                            </div>
                          )}
                          {comparison.isBestDeal && (
                            <span className="bg-luxury-gold text-black px-2 py-1 text-xs uppercase tracking-wider font-medium">
                              BEST DEAL
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <p className={`text-sm ${comparison.inStock ? 'text-luxury-gold' : 'text-red-400'}`}>
                            {comparison.inStock ? '✓ In Stock' : '✗ Out of Stock'}
                          </p>
                          {comparison.authenticity && (
                            <p className="text-xs text-luxury-gray">
                              Authenticity: {comparison.authenticity.score}/100
                            </p>
                          )}
                        </div>
                        {comparison.authenticity && comparison.authenticity.riskLevel === 'CAUTION' && (
                          <p className="text-xs text-yellow-400 mt-1">
                            ⚠️ {comparison.authenticity.recommendation}
                          </p>
                        )}
                        {comparison.authenticity && (comparison.authenticity.riskLevel === 'HIGH_RISK' || comparison.authenticity.riskLevel === 'AVOID') && (
                          <p className="text-xs text-red-400 mt-1">
                            🚨 {comparison.authenticity.recommendation}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-6 mb-3">
                        <div>
                          <p className="text-luxury-gray text-xs uppercase tracking-wider">PRODUCT PRICE</p>
                          <div className="flex items-center gap-2">
                            <span className="text-white text-lg font-light">
                              ${comparison.price.toFixed(2)}
                            </span>
                            {comparison.originalPrice && comparison.originalPrice > comparison.price && (
                              <span className="text-luxury-gray text-sm line-through">
                                ${comparison.originalPrice.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-luxury-gray text-xs uppercase tracking-wider">SHIPPING</p>
                          <p className="text-white text-lg font-light">
                            {comparison.shippingCost === 0 ? 'FREE' : `$${comparison.shippingCost.toFixed(2)}`}
                          </p>
                        </div>
                        <div>
                          <p className="text-luxury-gray text-xs uppercase tracking-wider">TOTAL COST</p>
                          <p className="text-luxury-gold text-lg font-light">
                            ${comparison.totalCost.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <a
                        href={comparison.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-2 text-luxury-gold text-sm uppercase tracking-wider hover:text-white transition-colors duration-300 border border-luxury-gold border-opacity-30 px-4 py-2 hover:border-opacity-100 ${
                          !comparison.inStock ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                        }`}
                      >
                        VIEW PRODUCT <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deal Insights */}
          {analytics && !loading && (
            <div className="border border-luxury-gold border-opacity-20 bg-luxury-black p-6">
              <h3 className="text-xl font-light text-white mb-4">Live Price Intelligence</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-luxury-gold text-2xl font-light">
                    {analytics.inStockRetailers}/{analytics.totalRetailers}
                  </div>
                  <p className="text-luxury-gray text-xs uppercase tracking-wider">
                    RETAILERS IN STOCK
                  </p>
                </div>
                <div>
                  <div className="text-luxury-gold text-2xl font-light">
                    ${analytics.priceDifference?.toFixed(2)}
                  </div>
                  <p className="text-luxury-gray text-xs uppercase tracking-wider">
                    PRICE DIFFERENCE
                  </p>
                </div>
                <div>
                  <div className="text-luxury-gold text-2xl font-light">
                    {analytics.maxSavingsPercentage}%
                  </div>
                  <p className="text-luxury-gray text-xs uppercase tracking-wider">
                    MAX SAVINGS
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Authenticity Guide Modal */}
      <AuthenticityGuide
        isOpen={showAuthenticityGuide}
        onClose={() => setShowAuthenticityGuide(false)}
      />
    </div>
  );
}