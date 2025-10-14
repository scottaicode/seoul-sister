'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Lock, TrendingUp, Beaker, Users, Eye, Bookmark, Share2, Download } from 'lucide-react';

interface ReportViewerProps {
  reportId?: string;
  isPremium?: boolean;
}

interface IntelligenceReport {
  id: string;
  reportDate: Date;
  title: string;
  subtitle: string;
  executiveSummary: string;
  trendingDiscoveries: any[];
  ingredientAnalysis: any[];
  koreanSocialInsights: any[];
  expertPredictions: any[];
  heroProduct?: any;
  heroIngredient?: any;
  viralTrend?: any;
  viewCount: number;
  saveCount: number;
}

export default function ReportViewer({ reportId, isPremium = false }: ReportViewerProps) {
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('summary');
  const [isLocked, setIsLocked] = useState(!isPremium);

  useEffect(() => {
    loadReport();
  }, [reportId]);

  const loadReport = async () => {
    try {
      setLoading(true);

      // If no reportId, load today's report
      const endpoint = reportId
        ? `/api/reports/${reportId}`
        : '/api/reports/today';

      const response = await fetch(endpoint);

      if (response.ok) {
        const data = await response.json();
        setReport(data);
      } else {
        // Use sample data if API fails
        setReport(getSampleReport());
      }
    } catch (error) {
      console.error('Error loading report:', error);
      setReport(getSampleReport());
    } finally {
      setLoading(false);
    }
  };

  const getSampleReport = (): IntelligenceReport => ({
    id: '1',
    reportDate: new Date(),
    title: 'Seoul Beauty Intelligence Report',
    subtitle: 'Exclusive insights from Korea\'s beauty capital',
    executiveSummary: `Today's intelligence reveals 5 breakthrough products trending in Seoul, with average savings of 73% versus US retail. Centella Asiatica dominates Korean formulations with a 98% popularity score, while the "Glass Skin" trend reaches viral status across Korean beauty platforms.`,
    viewCount: 1243,
    saveCount: 89,
    trendingDiscoveries: [
      {
        productName: 'Relief Sun: Rice + Probiotics',
        brand: 'Beauty of Joseon',
        category: 'Sunscreen',
        trendScore: 95,
        seoulPrice: 12000,
        usPrice: 18,
        savingsPercentage: 73,
        discoverySource: 'Olive Young',
        whyTrending: '#1 bestseller for 12 weeks straight',
        socialMentions: 45230
      },
      {
        productName: 'Advanced Snail 96 Mucin Power Essence',
        brand: 'COSRX',
        category: 'Essence',
        trendScore: 92,
        seoulPrice: 23000,
        usPrice: 29,
        savingsPercentage: 68,
        discoverySource: 'Hwahae',
        whyTrending: 'Viral TikTok glass skin routine essential',
        socialMentions: 38450
      }
    ],
    ingredientAnalysis: [
      {
        ingredientName: 'Centella Asiatica',
        inciName: 'Centella Asiatica Extract',
        category: 'Botanical',
        benefits: ['Healing', 'Anti-inflammatory', 'Collagen synthesis'],
        skinTypes: ['Sensitive', 'Acne-prone', 'All skin types'],
        trendingScore: 98,
        scientificBackup: '23 peer-reviewed studies confirm efficacy',
        koreanPopularity: 95
      }
    ],
    koreanSocialInsights: [
      {
        platform: 'TikTok Korea',
        trend: 'Glass Skin Challenge',
        virality: 94,
        hashtags: ['#유리피부', '#GlassSkinKorea'],
        influencers: ['@glowseoul', '@k.beauty.diary'],
        keyInsight: '450% growth in mentions over 30 days'
      }
    ],
    expertPredictions: [
      {
        prediction: 'Fermented ingredients will dominate Q2 2025',
        timeframe: '60-90 days',
        confidence: 85,
        rationale: 'Major brands preparing fermented product launches',
        recommendedActions: ['Stock fermented essences', 'Create educational content']
      }
    ],
    heroProduct: {
      name: 'Relief Sun: Rice + Probiotics',
      brand: 'Beauty of Joseon',
      seoulPrice: 12000,
      usPrice: 18,
      savings: 6,
      whyHero: 'Most requested product by Seoul Sisters community',
      keyIngredients: ['Rice Extract', 'Probiotics', 'Niacinamide']
    }
  });

  const sections = [
    { id: 'summary', label: 'Executive Summary', icon: Eye },
    { id: 'trending', label: 'Trending Discoveries', icon: TrendingUp },
    { id: 'ingredients', label: 'Ingredient Lab', icon: Beaker },
    { id: 'social', label: 'Social Insights', icon: Users },
    { id: 'predictions', label: 'Expert Predictions', icon: TrendingUp }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-2 border-[#D4A574] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#D4A574] text-sm uppercase tracking-wider">Loading Intelligence Report</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-[#D4A574]/20 backdrop-blur-xl bg-black/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#D4A574] text-xs uppercase tracking-widest mb-2">
                {report && format(new Date(report.reportDate), 'MMMM d, yyyy')}
              </p>
              <h1 className="text-3xl md:text-4xl font-light tracking-wide">
                {report?.title}
              </h1>
              <p className="text-gray-400 text-sm mt-2">
                {report?.subtitle}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <p className="text-2xl font-light text-[#D4A574]">{report?.viewCount.toLocaleString()}</p>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Views</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-light text-[#D4A574]">{report?.saveCount}</p>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Saves</p>
              </div>
            </div>
          </div>

          {/* Section Tabs */}
          <div className="flex space-x-8 mt-8 overflow-x-auto">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center space-x-2 pb-3 border-b-2 transition-all whitespace-nowrap ${
                    activeSection === section.id
                      ? 'border-[#D4A574] text-[#D4A574]'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon size={16} />
                  <span className="text-sm uppercase tracking-wider">{section.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {activeSection === 'summary' && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-8">
                <h2 className="text-2xl font-light mb-6 text-[#D4A574]">Executive Intelligence Brief</h2>
                <p className="text-gray-300 leading-relaxed text-lg">
                  {report?.executiveSummary}
                </p>
              </div>

              {/* Hero Product Spotlight */}
              {report?.heroProduct && (
                <div className="bg-gradient-to-r from-[#0A0A0A] to-[#1A1A1A] border border-[#D4A574]/30 rounded-lg p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-light text-[#D4A574]">Hero Product Discovery</h3>
                    <span className="px-3 py-1 bg-[#D4A574]/20 text-[#D4A574] text-xs uppercase tracking-wider rounded-full">
                      Must Have
                    </span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-2xl font-light mb-2">{report.heroProduct.name}</h4>
                      <p className="text-gray-400 mb-4">{report.heroProduct.brand}</p>
                      <p className="text-gray-300 mb-4">{report.heroProduct.whyHero}</p>
                      <div className="flex flex-wrap gap-2">
                        {report.heroProduct.keyIngredients?.map((ingredient: string, idx: number) => (
                          <span key={idx} className="px-3 py-1 bg-black/50 text-[#D4A574] text-xs rounded-full">
                            {ingredient}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-gray-400 text-sm uppercase tracking-wider mb-2">Seoul Price</p>
                        <p className="text-3xl font-light text-[#D4A574]">₩{report.heroProduct.seoulPrice.toLocaleString()}</p>
                        <p className="text-gray-400 line-through mt-2">${report.heroProduct.usPrice} US Retail</p>
                        <p className="text-green-400 text-2xl font-light mt-2">
                          Save ${report.heroProduct.savings}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeSection === 'trending' && (
            <motion.div
              key="trending"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {isLocked && !isPremium ? (
                <div className="bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-16 text-center">
                  <Lock className="w-12 h-12 text-[#D4A574] mx-auto mb-4" />
                  <h3 className="text-2xl font-light mb-4">Premium Members Only</h3>
                  <p className="text-gray-400 mb-6">
                    Unlock complete trending product intelligence with Seoul Sister membership
                  </p>
                  <button className="px-8 py-3 bg-[#D4A574] text-black text-sm uppercase tracking-wider hover:bg-[#B8956A] transition-colors">
                    Start 7-Day Free Trial
                  </button>
                </div>
              ) : (
                report?.trendingDiscoveries.map((product, idx) => (
                  <div key={idx} className="bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-3">
                          <span className="text-3xl font-light text-[#D4A574]">#{idx + 1}</span>
                          <div>
                            <h3 className="text-xl font-light">{product.productName}</h3>
                            <p className="text-gray-400 text-sm">{product.brand} · {product.category}</p>
                          </div>
                        </div>
                        <p className="text-gray-300 mb-4">{product.whyTrending}</p>
                        <div className="flex items-center space-x-6 text-sm">
                          <span className="text-gray-400">
                            Source: <span className="text-[#D4A574]">{product.discoverySource}</span>
                          </span>
                          <span className="text-gray-400">
                            Mentions: <span className="text-[#D4A574]">{product.socialMentions.toLocaleString()}</span>
                          </span>
                        </div>
                      </div>
                      <div className="text-right ml-6">
                        <div className="mb-2">
                          <p className="text-xs text-gray-400 uppercase tracking-wider">Trend Score</p>
                          <p className="text-2xl font-light text-[#D4A574]">{product.trendScore}</p>
                        </div>
                        <div className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded">
                          Save {product.savingsPercentage}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeSection === 'ingredients' && (
            <motion.div
              key="ingredients"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {report?.ingredientAnalysis.map((ingredient, idx) => (
                <div key={idx} className="bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-light mb-2">{ingredient.ingredientName}</h3>
                      <p className="text-gray-400 text-sm">{ingredient.inciName} · {ingredient.category}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-light text-[#D4A574]">{ingredient.koreanPopularity}%</p>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">K-Beauty Usage</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Benefits</p>
                      <div className="flex flex-wrap gap-2">
                        {ingredient.benefits.map((benefit: string, bidx: number) => (
                          <span key={bidx} className="px-3 py-1 bg-[#D4A574]/10 text-[#D4A574] text-sm rounded">
                            {benefit}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Best For</p>
                      <div className="flex flex-wrap gap-2">
                        {ingredient.skinTypes.map((type: string, tidx: number) => (
                          <span key={tidx} className="px-3 py-1 bg-black/50 text-gray-300 text-sm rounded">
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm">
                      <span className="text-[#D4A574]">Research:</span> {ingredient.scientificBackup}
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Bar */}
        <div className="fixed bottom-8 right-8 flex flex-col space-y-3">
          <button className="p-3 bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg hover:bg-[#1A1A1A] transition-colors">
            <Bookmark size={20} className="text-[#D4A574]" />
          </button>
          <button className="p-3 bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg hover:bg-[#1A1A1A] transition-colors">
            <Share2 size={20} className="text-[#D4A574]" />
          </button>
          <button className="p-3 bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg hover:bg-[#1A1A1A] transition-colors">
            <Download size={20} className="text-[#D4A574]" />
          </button>
        </div>
      </main>
    </div>
  );
}