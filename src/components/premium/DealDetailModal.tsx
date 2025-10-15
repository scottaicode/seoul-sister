'use client';

import { useState } from 'react';
import { X, ExternalLink, TrendingDown, Clock, Star } from 'lucide-react';

interface DealDetailModalProps {
  deal: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function DealDetailModal({ deal, isOpen, onClose }: DealDetailModalProps) {
  if (!isOpen || !deal) return null;

  // Mock price comparison data for the specific product
  const priceComparisons = [
    {
      retailer: deal.price_retailers?.name || 'YesStyle',
      price: deal.current_price,
      originalPrice: deal.previous_price,
      inStock: true,
      shippingCost: 7.99,
      totalCost: deal.current_price + 7.99,
      url: `https://${deal.price_retailers?.domain || 'yesstyle.com'}/product/${deal.product_id}`,
      isBestDeal: true
    },
    {
      retailer: 'Sephora',
      price: deal.previous_price,
      inStock: true,
      shippingCost: 5.95,
      totalCost: deal.previous_price + 5.95,
      url: `https://sephora.com/product/${deal.product_id}`,
      isBestDeal: false
    },
    {
      retailer: 'Amazon',
      price: deal.current_price + 3.00,
      inStock: true,
      shippingCost: 0,
      totalCost: deal.current_price + 3.00,
      url: `https://amazon.com/dp/${deal.product_id}`,
      isBestDeal: false
    },
    {
      retailer: 'StyleKorean',
      price: deal.current_price + 1.50,
      originalPrice: deal.previous_price + 2.00,
      inStock: false,
      shippingCost: 6.99,
      totalCost: deal.current_price + 1.50 + 6.99,
      url: `https://stylekorean.com/product/${deal.product_id}`,
      isBestDeal: false
    }
  ].sort((a, b) => a.totalCost - b.totalCost);

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
            <div className="flex items-center gap-3 mb-6">
              <TrendingDown className="text-luxury-gold" size={24} />
              <h3 className="text-xl font-light text-white">Price Comparison</h3>
            </div>

            <div className="space-y-4">
              {priceComparisons.map((comparison, index) => (
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
                        <h4 className="text-white font-light text-lg">
                          {comparison.retailer}
                          {comparison.isBestDeal && (
                            <span className="ml-3 bg-luxury-gold text-black px-2 py-1 text-xs uppercase tracking-wider font-medium">
                              BEST DEAL
                            </span>
                          )}
                        </h4>
                        <p className={`text-sm ${comparison.inStock ? 'text-luxury-gold' : 'text-red-400'}`}>
                          {comparison.inStock ? '✓ In Stock' : '✗ Out of Stock'}
                        </p>
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
          <div className="border border-luxury-gold border-opacity-20 bg-luxury-black p-6">
            <h3 className="text-xl font-light text-white mb-4">Deal Intelligence</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-luxury-gold text-2xl font-light">
                  {priceComparisons.filter(p => p.inStock).length}/{priceComparisons.length}
                </div>
                <p className="text-luxury-gray text-xs uppercase tracking-wider">
                  RETAILERS IN STOCK
                </p>
              </div>
              <div>
                <div className="text-luxury-gold text-2xl font-light">
                  ${(Math.max(...priceComparisons.map(p => p.totalCost)) - Math.min(...priceComparisons.filter(p => p.inStock).map(p => p.totalCost))).toFixed(2)}
                </div>
                <p className="text-luxury-gray text-xs uppercase tracking-wider">
                  PRICE DIFFERENCE
                </p>
              </div>
              <div>
                <div className="text-luxury-gold text-2xl font-light">
                  {Math.round((1 - Math.min(...priceComparisons.filter(p => p.inStock).map(p => p.totalCost)) / Math.max(...priceComparisons.map(p => p.totalCost))) * 100)}%
                </div>
                <p className="text-luxury-gray text-xs uppercase tracking-wider">
                  MAX SAVINGS
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}