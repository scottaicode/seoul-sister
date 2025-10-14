'use client';

interface Deal {
  id: string;
  product_id: string;
  current_price: number;
  previous_price: number;
  savings_amount: number;
  savings_percentage: number;
  deal_type: string;
  deal_score: number;
  price_retailers?: {
    name: string;
    domain: string;
  };
  product?: {
    name: string;
    brand: string;
    image_url?: string;
    category: string;
  };
}

interface DealAlertsWidgetProps {
  deals: Deal[];
  showAll?: boolean;
}

export default function DealAlertsWidget({ deals, showAll = false }: DealAlertsWidgetProps) {
  const displayDeals = showAll ? deals : deals.slice(0, 5);

  return (
    <div className="bg-luxury-black-soft border border-luxury-gold border-opacity-20 p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-luxury-gold text-xs uppercase tracking-wider mb-2">PRICE INTELLIGENCE</p>
          <h3 className="text-2xl font-light text-white">
            {showAll ? 'All Deals Today' : 'Top Deals Today'}
          </h3>
        </div>
        <div className="text-right">
          <div className="text-luxury-gold text-lg font-light">
            {deals.length}
          </div>
          <p className="text-luxury-gray text-xs uppercase tracking-wider">
            DEALS FOUND
          </p>
        </div>
      </div>

      {displayDeals.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-luxury-gray">
            No deals found today. Our system is constantly monitoring prices across 8+ retailers.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {displayDeals.map((deal) => (
            <div
              key={deal.id}
              className="border border-luxury-gold border-opacity-10 p-6 hover:border-opacity-30 transition-all duration-300"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-luxury-gold bg-opacity-10 rounded flex items-center justify-center">
                      <span className="text-luxury-gold text-lg">
                        {deal.product?.category === 'skincare' ? '🧴' :
                         deal.product?.category === 'makeup' ? '💄' : '✨'}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-white font-light">
                        {deal.product?.name || 'Product'}
                      </h4>
                      <p className="text-luxury-gray text-sm">
                        {deal.product?.brand} • {deal.price_retailers?.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-luxury-gray text-xs uppercase tracking-wider mb-1">
                        CURRENT PRICE
                      </p>
                      <p className="text-white text-lg font-light">
                        ${deal.current_price.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-luxury-gray text-xs uppercase tracking-wider mb-1">
                        WAS
                      </p>
                      <p className="text-luxury-gray text-lg font-light line-through">
                        ${deal.previous_price.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-luxury-gray text-xs uppercase tracking-wider mb-1">
                        SAVINGS
                      </p>
                      <p className="text-luxury-gold text-lg font-light">
                        ${deal.savings_amount.toFixed(2)} ({deal.savings_percentage.toFixed(0)}%)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="mb-3">
                    <span className={`inline-block px-3 py-1 text-xs uppercase tracking-wider ${
                      deal.deal_score >= 80 ? 'bg-luxury-gold text-black' :
                      deal.deal_score >= 60 ? 'bg-luxury-gold bg-opacity-20 text-luxury-gold' :
                      'bg-luxury-gray bg-opacity-20 text-luxury-gray'
                    }`}>
                      {deal.deal_score >= 80 ? 'EXCELLENT' :
                       deal.deal_score >= 60 ? 'GOOD DEAL' : 'FAIR'}
                    </span>
                  </div>
                  <button className="text-luxury-gold text-sm uppercase tracking-wider hover:text-white transition-colors duration-300 border border-luxury-gold border-opacity-30 px-4 py-2 hover:border-opacity-100">
                    VIEW DEAL →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showAll && deals.length > 5 && (
        <div className="mt-8 text-center">
          <button className="text-luxury-gold text-sm uppercase tracking-wider hover:text-white transition-colors duration-300">
            VIEW ALL {deals.length} DEALS →
          </button>
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-luxury-gold border-opacity-10">
        <div className="grid grid-cols-2 gap-6 text-center">
          <div>
            <div className="text-luxury-gold text-xl font-light">
              ${deals.reduce((sum, deal) => sum + deal.savings_amount, 0).toFixed(0)}
            </div>
            <p className="text-luxury-gray text-xs uppercase tracking-wider">
              TOTAL SAVINGS AVAILABLE
            </p>
          </div>
          <div>
            <div className="text-luxury-gold text-xl font-light">
              {deals.length > 0 ? (deals.reduce((sum, deal) => sum + deal.savings_percentage, 0) / deals.length).toFixed(0) : 0}%
            </div>
            <p className="text-luxury-gray text-xs uppercase tracking-wider">
              AVERAGE SAVINGS
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}