'use client';

import { useState } from 'react';
import { X, Shield, AlertTriangle, XCircle, CheckCircle, Info } from 'lucide-react';
import AuthenticityIcon from './AuthenticityIcon';

interface AuthenticityGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthenticityGuide({ isOpen, onClose }: AuthenticityGuideProps) {
  if (!isOpen) return null;

  const riskLevels = [
    {
      level: 'VERIFIED',
      score: '90-100',
      iconType: 'verified',
      color: '#D4AF37',
      description: 'Official authorized retailers with guaranteed authenticity',
      examples: ['YesStyle', 'StyleKorean', 'Olive Young Global'],
      recommendation: 'Safe to purchase - these retailers have direct brand partnerships'
    },
    {
      level: 'TRUSTED',
      score: '80-89',
      iconType: 'trusted',
      color: '#10B981',
      description: 'Established retailers with strong authenticity policies',
      examples: ['Sephora', 'Ulta', 'Official brand stores'],
      recommendation: 'Reliable retailers with good track records'
    },
    {
      level: 'CAUTION',
      score: '65-79',
      iconType: 'warning',
      color: '#F59E0B',
      description: 'Marketplaces requiring seller verification',
      examples: ['Amazon (verify seller)', 'Target online'],
      recommendation: 'Check seller credentials and reviews before purchasing'
    },
    {
      level: 'HIGH_RISK',
      score: '45-64',
      iconType: 'danger',
      color: '#F97316',
      description: 'Platforms with known counterfeit issues',
      examples: ['Unknown sellers', 'Unverified marketplaces'],
      recommendation: 'High probability of counterfeit - avoid unless verified'
    },
    {
      level: 'AVOID',
      score: '0-44',
      iconType: 'blocked',
      color: '#DC2626',
      description: 'High-risk platforms with frequent counterfeits',
      examples: ['AliExpress', 'DHgate', 'Wish'],
      recommendation: 'Extremely high counterfeit risk - not recommended'
    }
  ];

  const redFlags = [
    'Price significantly below authentic range (60%+ discount)',
    'Seller with no history or poor reviews',
    'Products shipped from unknown locations',
    'Missing or altered brand packaging',
    'No batch codes or expiration dates',
    'Suspicious seller names (random characters)',
    'Multiple identical products at different prices'
  ];

  const authenticityTips = [
    'Always buy from official brand retailers when possible',
    'Check if the retailer is listed on the brand\'s official website',
    'Compare prices - extremely low prices are often counterfeit',
    'Read seller reviews and check their history',
    'Look for proper product images and descriptions',
    'Verify batch codes using brand websites or apps',
    'Be wary of "limited time" deals on unmarked products'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-auto bg-black border border-luxury-gold border-opacity-30 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-black border-b border-luxury-gold border-opacity-20 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="text-luxury-gold" size={24} />
              <div>
                <h2 className="text-2xl font-light text-white">Authenticity Verification Guide</h2>
                <p className="text-luxury-gray">How Seoul Sister protects you from counterfeit Korean beauty products</p>
              </div>
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
        <div className="p-6 space-y-8">
          {/* Authenticity Scoring System */}
          <div>
            <h3 className="text-xl font-light text-white mb-6 flex items-center gap-3">
              <Info className="text-luxury-gold" size={20} />
              Our AI-Powered Authenticity Scoring
            </h3>

            <div className="space-y-4">
              {riskLevels.map((level, index) => (
                <div
                  key={index}
                  className="border border-luxury-gold border-opacity-10 p-4 rounded-lg bg-luxury-black-soft"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex items-center gap-3">
                      <AuthenticityIcon
                        iconType={level.iconType}
                        riskColor={level.color}
                        size={24}
                      />
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span
                            className="px-3 py-1 text-sm font-medium rounded"
                            style={{
                              backgroundColor: `${level.color}20`,
                              color: level.color,
                              border: `1px solid ${level.color}40`
                            }}
                          >
                            {level.level}
                          </span>
                          <span className="text-luxury-gray text-sm">Score: {level.score}</span>
                        </div>
                        <p className="text-white font-light mb-2">{level.description}</p>
                        <p className="text-luxury-gray text-sm mb-3">{level.recommendation}</p>
                        <div className="flex flex-wrap gap-2">
                          {level.examples.map((example, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 text-xs bg-luxury-gold bg-opacity-10 text-luxury-gold rounded"
                            >
                              {example}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Red Flags */}
          <div>
            <h3 className="text-xl font-light text-white mb-4 flex items-center gap-3">
              <AlertTriangle className="text-red-400" size={20} />
              Counterfeit Warning Signs
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {redFlags.map((flag, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border border-red-400 border-opacity-20 rounded bg-red-400 bg-opacity-5">
                  <XCircle className="text-red-400 mt-1 flex-shrink-0" size={16} />
                  <p className="text-red-400 text-sm">{flag}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Authenticity Tips */}
          <div>
            <h3 className="text-xl font-light text-white mb-4 flex items-center gap-3">
              <CheckCircle className="text-luxury-gold" size={20} />
              How to Buy Authentic K-Beauty
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {authenticityTips.map((tip, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border border-luxury-gold border-opacity-20 rounded bg-luxury-gold bg-opacity-5">
                  <CheckCircle className="text-luxury-gold mt-1 flex-shrink-0" size={16} />
                  <p className="text-luxury-gold text-sm">{tip}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Official Retailers */}
          <div className="border border-luxury-gold border-opacity-20 bg-luxury-black p-6 rounded-lg">
            <h3 className="text-xl font-light text-white mb-4">Verified Official Retailers</h3>
            <p className="text-luxury-gray mb-4">
              These retailers are officially authorized by major K-beauty brands and guarantee authentic products:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: 'YesStyle', score: 95 },
                { name: 'StyleKorean', score: 95 },
                { name: 'Olive Young Global', score: 98 },
                { name: 'Sephora', score: 90 }
              ].map((retailer, index) => (
                <div key={index} className="text-center p-3 border border-luxury-gold border-opacity-10 rounded">
                  <p className="text-white font-light">{retailer.name}</p>
                  <p className="text-luxury-gold text-sm">{retailer.score}/100</p>
                </div>
              ))}
            </div>
          </div>

          {/* Research Backing */}
          <div className="border border-luxury-gold border-opacity-10 p-6 bg-luxury-black-soft rounded-lg">
            <h3 className="text-xl font-light text-white mb-4">Research-Backed Protection</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-luxury-gold text-2xl font-light mb-2">70%</div>
                <p className="text-luxury-gray text-sm">of online shoppers unknowingly buy counterfeit products</p>
              </div>
              <div>
                <div className="text-luxury-gold text-2xl font-light mb-2">50%</div>
                <p className="text-luxury-gray text-sm">of brands lose sales to counterfeit products</p>
              </div>
              <div>
                <div className="text-luxury-gold text-2xl font-light mb-2">98%</div>
                <p className="text-luxury-gray text-sm">accuracy rate of AI-powered authenticity detection</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}