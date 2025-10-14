'use client';

import { useState } from 'react';

interface WatchlistItem {
  id: string;
  product_id: string;
  target_price?: number;
  alert_on_restock: boolean;
  alert_on_sale: boolean;
  best_price_seen?: number;
  product?: {
    name: string;
    brand: string;
    image_url?: string;
    category: string;
  };
  current_prices?: Array<{
    retailer_name: string;
    current_price: number;
    in_stock: boolean;
  }>;
}

interface WatchlistWidgetProps {
  items: WatchlistItem[];
}

export default function WatchlistWidget({ items }: WatchlistWidgetProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="bg-luxury-black-soft border border-luxury-gold border-opacity-20 p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-luxury-gold text-xs uppercase tracking-wider mb-2">PRICE TRACKING</p>
          <h3 className="text-2xl font-light text-white">My Watchlist</h3>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-transparent border border-luxury-gold text-luxury-gold px-6 py-2 text-sm uppercase tracking-wider hover:bg-luxury-gold hover:text-black transition-all duration-300"
        >
          + ADD PRODUCT
        </button>
      </div>

      {showAddForm && (
        <div className="mb-8 p-6 border border-luxury-gold border-opacity-20 bg-luxury-black">
          <h4 className="text-white font-light mb-4">Add Product to Watchlist</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-luxury-gray text-sm uppercase tracking-wider mb-2">
                Search Product
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter product name or brand..."
                className="w-full bg-transparent border border-luxury-gold border-opacity-30 text-white px-4 py-3 focus:border-luxury-gold focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-luxury-gray text-sm uppercase tracking-wider mb-2">
                  Target Price (Optional)
                </label>
                <input
                  type="number"
                  placeholder="$0.00"
                  className="w-full bg-transparent border border-luxury-gold border-opacity-30 text-white px-4 py-3 focus:border-luxury-gold focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-luxury-gray text-sm uppercase tracking-wider">
                  Alert Preferences
                </label>
                <div className="space-y-2">
                  <label className="flex items-center text-sm text-luxury-gray">
                    <input type="checkbox" className="mr-3 accent-luxury-gold" defaultChecked />
                    Price drops
                  </label>
                  <label className="flex items-center text-sm text-luxury-gray">
                    <input type="checkbox" className="mr-3 accent-luxury-gold" defaultChecked />
                    Back in stock
                  </label>
                  <label className="flex items-center text-sm text-luxury-gray">
                    <input type="checkbox" className="mr-3 accent-luxury-gold" defaultChecked />
                    Sales & promotions
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <button className="bg-luxury-gold text-black px-6 py-2 text-sm uppercase tracking-wider hover:bg-opacity-90 transition-all duration-300">
                ADD TO WATCHLIST
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="border border-luxury-gold border-opacity-30 text-luxury-gray px-6 py-2 text-sm uppercase tracking-wider hover:text-luxury-gold hover:border-opacity-100 transition-all duration-300"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-6">👁️</div>
          <h4 className="text-white text-xl font-light mb-4">
            Your Watchlist is Empty
          </h4>
          <p className="text-luxury-gray mb-8 max-w-md mx-auto">
            Add Korean beauty products to track their prices across 8+ retailers.
            Get instant alerts when prices drop or items come back in stock.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-2xl mb-2">💰</div>
              <p className="text-luxury-gray text-sm">
                Track price changes across all retailers
              </p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">🔔</div>
              <p className="text-luxury-gray text-sm">
                Get alerts when target prices are reached
              </p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">📦</div>
              <p className="text-luxury-gray text-sm">
                Know instantly when items restock
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="border border-luxury-gold border-opacity-10 p-6 hover:border-opacity-30 transition-all duration-300"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-16 h-16 bg-luxury-gold bg-opacity-10 rounded flex items-center justify-center">
                    <span className="text-luxury-gold text-xl">
                      {item.product?.category === 'skincare' ? '🧴' :
                       item.product?.category === 'makeup' ? '💄' : '✨'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-light text-lg mb-1">
                      {item.product?.name || 'Product Name'}
                    </h4>
                    <p className="text-luxury-gray text-sm mb-4">
                      {item.product?.brand}
                    </p>

                    {item.target_price && (
                      <div className="mb-4">
                        <span className="bg-luxury-gold bg-opacity-20 text-luxury-gold px-3 py-1 text-xs uppercase tracking-wider">
                          TARGET: ${item.target_price.toFixed(2)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-luxury-gray">Best Price Seen:</span>
                        <span className="text-luxury-gold">
                          ${item.best_price_seen?.toFixed(2) || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-luxury-gray">Alerts:</span>
                        <span className="text-white text-xs">
                          {[
                            item.alert_on_sale && 'Sales',
                            item.alert_on_restock && 'Restock'
                          ].filter(Boolean).join(', ') || 'None'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="mb-4">
                    {item.current_prices && item.current_prices.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-luxury-gray text-xs uppercase tracking-wider">
                          CURRENT PRICES
                        </p>
                        {item.current_prices.slice(0, 3).map((price, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-4">
                            <span className="text-luxury-gray text-sm">
                              {price.retailer_name}
                            </span>
                            <div className="text-right">
                              <span className="text-white">
                                ${price.current_price.toFixed(2)}
                              </span>
                              {!price.in_stock && (
                                <span className="text-red-400 text-xs ml-2">OOS</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-luxury-gray text-sm">No price data</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button className="text-luxury-gold text-xs uppercase tracking-wider hover:text-white transition-colors duration-300 border border-luxury-gold border-opacity-30 px-3 py-1 hover:border-opacity-100">
                      EDIT
                    </button>
                    <button className="text-red-400 text-xs uppercase tracking-wider hover:text-red-300 transition-colors duration-300 border border-red-400 border-opacity-30 px-3 py-1 hover:border-opacity-100">
                      REMOVE
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-8 pt-6 border-t border-luxury-gold border-opacity-10">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-luxury-gold text-xl font-light">
                {items.length}
              </div>
              <p className="text-luxury-gray text-xs uppercase tracking-wider">
                PRODUCTS TRACKED
              </p>
            </div>
            <div>
              <div className="text-luxury-gold text-xl font-light">
                {items.filter(item => item.alert_on_sale || item.alert_on_restock).length}
              </div>
              <p className="text-luxury-gray text-xs uppercase tracking-wider">
                ACTIVE ALERTS
              </p>
            </div>
            <div>
              <div className="text-luxury-gold text-xl font-light">
                ${items.reduce((sum, item) => sum + (item.best_price_seen || 0), 0).toFixed(0)}
              </div>
              <p className="text-luxury-gray text-xs uppercase tracking-wider">
                POTENTIAL SAVINGS
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}