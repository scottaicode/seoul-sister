'use client';

import { useState, useEffect } from 'react';
import PriceComparisonWidget from './PriceComparisonWidget';
import DealAlertsWidget from './DealAlertsWidget';
import IntelligenceReportWidget from './IntelligenceReportWidget';
import WatchlistWidget from './WatchlistWidget';
import SupplierDirectoryWidget from './SupplierDirectoryWidget';
import SkinAnalysisWidget from './SkinAnalysisWidget';

interface DashboardData {
  todaysDeals: any[];
  watchlistItems: any[];
  recentReports: any[];
  savingsThisMonth: number;
  dealsFound: number;
  productsTracked: number;
}

export default function PremiumDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    todaysDeals: [],
    watchlistItems: [],
    recentReports: [],
    savingsThisMonth: 0,
    dealsFound: 0,
    productsTracked: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeWidget, setActiveWidget] = useState('overview');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load dashboard data from APIs
      const [dealsResponse, reportsResponse] = await Promise.all([
        fetch('/api/price-intelligence/deals'),
        fetch('/api/intelligence-report/recent')
      ]);

      const deals = await dealsResponse.json();
      const reports = await reportsResponse.json();

      setDashboardData({
        todaysDeals: deals.deals || [],
        watchlistItems: [], // Will be loaded from user's watchlist
        recentReports: reports.reports || [],
        savingsThisMonth: deals.summary?.totalSavingsAmount || 0,
        dealsFound: deals.summary?.totalDeals || 0,
        productsTracked: 150 // Placeholder
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-luxury-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-luxury-gray text-sm uppercase tracking-wider">LOADING INTELLIGENCE</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-luxury-gold border-opacity-10">
        <div className="luxury-container py-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-luxury-gold text-xs uppercase tracking-wider mb-2">PREMIUM INTELLIGENCE</p>
              <h1 className="text-4xl md:text-5xl font-light text-white">
                Your Dashboard
              </h1>
              <p className="text-luxury-gray mt-2">
                Real-time Korean beauty intelligence & exclusive insider access
              </p>
            </div>
            <div className="text-right">
              <p className="text-luxury-gold text-sm uppercase tracking-wider">MEMBER SINCE</p>
              <p className="text-white text-lg">JANUARY 2025</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="luxury-container py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="text-center p-8 border border-luxury-gold border-opacity-20 bg-luxury-black-soft">
            <div className="text-3xl md:text-4xl font-light text-luxury-gold mb-2">
              ${dashboardData.savingsThisMonth.toFixed(0)}
            </div>
            <p className="text-luxury-gray text-sm uppercase tracking-wider">
              POTENTIAL SAVINGS THIS MONTH
            </p>
          </div>
          <div className="text-center p-8 border border-luxury-gold border-opacity-20 bg-luxury-black-soft">
            <div className="text-3xl md:text-4xl font-light text-luxury-gold mb-2">
              {dashboardData.dealsFound}
            </div>
            <p className="text-luxury-gray text-sm uppercase tracking-wider">
              DEALS DISCOVERED TODAY
            </p>
          </div>
          <div className="text-center p-8 border border-luxury-gold border-opacity-20 bg-luxury-black-soft">
            <div className="text-3xl md:text-4xl font-light text-luxury-gold mb-2">
              {dashboardData.productsTracked}
            </div>
            <p className="text-luxury-gray text-sm uppercase tracking-wider">
              PRODUCTS TRACKED
            </p>
          </div>
        </div>

        {/* Navigation */}
        <div className="mb-12">
          <div className="flex flex-wrap gap-4 justify-center">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'deals', label: 'Today\'s Deals' },
              { id: 'watchlist', label: 'My Watchlist' },
              { id: 'analysis', label: 'Skin Analysis' },
              { id: 'suppliers', label: 'Seoul Suppliers' },
              { id: 'reports', label: 'Intelligence' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveWidget(tab.id)}
                className={`px-6 py-3 text-sm uppercase tracking-wider font-light border transition-all duration-300 ${
                  activeWidget === tab.id
                    ? 'border-luxury-gold text-luxury-gold bg-luxury-gold bg-opacity-5'
                    : 'border-luxury-gold border-opacity-20 text-luxury-gray hover:text-luxury-gold hover:border-opacity-40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Widgets */}
        <div className="space-y-16">
          {activeWidget === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <DealAlertsWidget deals={dashboardData.todaysDeals.slice(0, 5)} />
              <IntelligenceReportWidget reports={dashboardData.recentReports.slice(0, 3)} />
            </div>
          )}

          {activeWidget === 'deals' && (
            <DealAlertsWidget deals={dashboardData.todaysDeals} showAll={true} />
          )}

          {activeWidget === 'watchlist' && (
            <WatchlistWidget items={dashboardData.watchlistItems} />
          )}

          {activeWidget === 'analysis' && (
            <SkinAnalysisWidget />
          )}

          {activeWidget === 'suppliers' && (
            <SupplierDirectoryWidget />
          )}

          {activeWidget === 'reports' && (
            <IntelligenceReportWidget reports={dashboardData.recentReports} showAll={true} />
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-20 pt-16 border-t border-luxury-gold border-opacity-10">
          <div className="text-center mb-12">
            <p className="text-luxury-gold text-xs uppercase tracking-wider mb-4">QUICK ACTIONS</p>
            <h2 className="text-3xl md:text-4xl font-light text-white mb-4">
              Premium Services
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-8 border border-luxury-gold border-opacity-20 text-center hover:bg-luxury-black-soft transition-all duration-300">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-xl font-light text-white mb-3">Price Analysis</h3>
              <p className="text-luxury-gray text-sm mb-6">
                Get instant price comparison across 8+ retailers for any Korean beauty product.
              </p>
              <button className="text-luxury-gold text-sm uppercase tracking-wider hover:text-white transition-colors duration-300">
                ANALYZE PRICE →
              </button>
            </div>

            <div className="p-8 border border-luxury-gold border-opacity-20 text-center hover:bg-luxury-black-soft transition-all duration-300">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-xl font-light text-white mb-3">WhatsApp Concierge</h3>
              <p className="text-luxury-gray text-sm mb-6">
                Get personalized product recommendations and ordering assistance via WhatsApp.
              </p>
              <button className="text-luxury-gold text-sm uppercase tracking-wider hover:text-white transition-colors duration-300">
                START CHAT →
              </button>
            </div>

            <div className="p-8 border border-luxury-gold border-opacity-20 text-center hover:bg-luxury-black-soft transition-all duration-300">
              <div className="text-4xl mb-4">🇰🇷</div>
              <h3 className="text-xl font-light text-white mb-3">Seoul Suppliers</h3>
              <p className="text-luxury-gray text-sm mb-6">
                Access verified Korean suppliers for wholesale pricing and group buying opportunities.
              </p>
              <button className="text-luxury-gold text-sm uppercase tracking-wider hover:text-white transition-colors duration-300">
                VIEW DIRECTORY →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}