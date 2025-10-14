'use client';

import { useState } from 'react';

interface SkinAnalysisResult {
  skin_type: string;
  primary_concerns: string[];
  recommended_products: Array<{
    name: string;
    brand: string;
    reason: string;
    compatibility_score: number;
  }>;
  ingredients_to_avoid: string[];
  routine_suggestions: string[];
}

export default function SkinAnalysisWidget() {
  const [analysisStep, setAnalysisStep] = useState<'questionnaire' | 'results'>('questionnaire');
  const [formData, setFormData] = useState({
    skinType: '',
    primaryConcerns: [] as string[],
    currentProducts: '',
    allergies: '',
    lifestyle: '',
    goals: ''
  });
  const [analysisResult, setAnalysisResult] = useState<SkinAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const skinTypes = [
    { id: 'oily', label: 'Oily', description: 'Shiny, large pores, prone to breakouts' },
    { id: 'dry', label: 'Dry', description: 'Tight, flaky, sometimes itchy' },
    { id: 'combination', label: 'Combination', description: 'Oily T-zone, dry cheeks' },
    { id: 'sensitive', label: 'Sensitive', description: 'Reactive, easily irritated' },
    { id: 'normal', label: 'Normal', description: 'Balanced, minimal issues' }
  ];

  const concerns = [
    'Acne & Breakouts', 'Fine Lines & Wrinkles', 'Dark Spots', 'Dullness',
    'Large Pores', 'Dehydration', 'Redness', 'Uneven Texture'
  ];

  const handleConcernToggle = (concern: string) => {
    setFormData(prev => ({
      ...prev,
      primaryConcerns: prev.primaryConcerns.includes(concern)
        ? prev.primaryConcerns.filter(c => c !== concern)
        : [...prev.primaryConcerns, concern]
    }));
  };

  const handleAnalysis = async () => {
    setIsAnalyzing(true);

    // Simulate AI analysis - replace with actual API call
    setTimeout(() => {
      const mockResult: SkinAnalysisResult = {
        skin_type: formData.skinType,
        primary_concerns: formData.primaryConcerns,
        recommended_products: [
          {
            name: 'Advanced Snail 96 Mucin Power Essence',
            brand: 'COSRX',
            reason: 'Perfect for hydration and healing, matches your sensitive skin type',
            compatibility_score: 95
          },
          {
            name: 'Beauty of Joseon Relief Sun',
            brand: 'Beauty of Joseon',
            reason: 'Gentle SPF ideal for sensitive skin with niacinamide for pore care',
            compatibility_score: 92
          },
          {
            name: 'Centella Unscented Serum',
            brand: 'Purito',
            reason: 'Centella asiatica calms irritation and reduces redness',
            compatibility_score: 90
          }
        ],
        ingredients_to_avoid: ['Fragrance', 'Denatured Alcohol', 'Essential Oils'],
        routine_suggestions: [
          'Start with gentle cleansing using a low-pH cleanser',
          'Apply essence on damp skin for better absorption',
          'Always use SPF during the day, even indoors',
          'Introduce new products one at a time'
        ]
      };

      setAnalysisResult(mockResult);
      setAnalysisStep('results');
      setIsAnalyzing(false);
    }, 3000);
  };

  if (isAnalyzing) {
    return (
      <div className="bg-luxury-black-soft border border-luxury-gold border-opacity-20 p-8">
        <div className="text-center py-16">
          <div className="w-16 h-16 border-2 border-luxury-gold border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h3 className="text-2xl font-light text-white mb-4">
            Analyzing Your Skin Profile
          </h3>
          <p className="text-luxury-gray mb-6">
            Our AI is processing your responses and matching you with the perfect Korean beauty products...
          </p>
          <div className="space-y-2 text-sm text-luxury-gray">
            <p>✓ Analyzing skin type compatibility</p>
            <p>✓ Checking ingredient interactions</p>
            <p>✓ Matching Korean beauty products</p>
            <p className="text-luxury-gold">⟳ Generating personalized routine</p>
          </div>
        </div>
      </div>
    );
  }

  if (analysisStep === 'results' && analysisResult) {
    return (
      <div className="bg-luxury-black-soft border border-luxury-gold border-opacity-20 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-luxury-gold text-xs uppercase tracking-wider mb-2">AI SKIN ANALYSIS</p>
            <h3 className="text-2xl font-light text-white">Your Personalized Results</h3>
          </div>
          <button
            onClick={() => setAnalysisStep('questionnaire')}
            className="text-luxury-gold text-sm uppercase tracking-wider hover:text-white transition-colors duration-300 border border-luxury-gold border-opacity-30 px-4 py-2 hover:border-opacity-100"
          >
            RETAKE ANALYSIS
          </button>
        </div>

        <div className="space-y-8">
          {/* Skin Profile Summary */}
          <div className="border border-luxury-gold border-opacity-20 p-6">
            <h4 className="text-white font-light text-lg mb-4">Your Skin Profile</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-luxury-gray text-sm uppercase tracking-wider mb-2">SKIN TYPE</p>
                <p className="text-luxury-gold text-lg capitalize">{analysisResult.skin_type}</p>
              </div>
              <div>
                <p className="text-luxury-gray text-sm uppercase tracking-wider mb-2">PRIMARY CONCERNS</p>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.primary_concerns.map((concern, idx) => (
                    <span key={idx} className="bg-luxury-gold bg-opacity-20 text-luxury-gold px-2 py-1 text-xs">
                      {concern}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Recommended Products */}
          <div>
            <h4 className="text-white font-light text-lg mb-6">Recommended Korean Products</h4>
            <div className="space-y-4">
              {analysisResult.recommended_products.map((product, idx) => (
                <div key={idx} className="border border-luxury-gold border-opacity-10 p-6 hover:border-opacity-30 transition-all duration-300">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-luxury-gold bg-opacity-10 rounded flex items-center justify-center">
                          <span className="text-luxury-gold text-lg">✨</span>
                        </div>
                        <div>
                          <h5 className="text-white font-light">{product.name}</h5>
                          <p className="text-luxury-gray text-sm">{product.brand}</p>
                        </div>
                      </div>
                      <p className="text-luxury-gray text-sm">{product.reason}</p>
                    </div>
                    <div className="text-right">
                      <div className="mb-2">
                        <span className="text-luxury-gold text-lg font-light">
                          {product.compatibility_score}%
                        </span>
                        <p className="text-luxury-gray text-xs uppercase tracking-wider">
                          COMPATIBILITY
                        </p>
                      </div>
                      <button className="text-luxury-gold text-xs uppercase tracking-wider hover:text-white transition-colors duration-300 border border-luxury-gold border-opacity-30 px-3 py-1 hover:border-opacity-100">
                        VIEW PRICES
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ingredients to Avoid */}
          <div>
            <h4 className="text-white font-light text-lg mb-4">Ingredients to Avoid</h4>
            <div className="flex flex-wrap gap-3">
              {analysisResult.ingredients_to_avoid.map((ingredient, idx) => (
                <span key={idx} className="bg-red-500 bg-opacity-20 text-red-400 px-3 py-1 text-sm border border-red-500 border-opacity-30">
                  {ingredient}
                </span>
              ))}
            </div>
          </div>

          {/* Routine Suggestions */}
          <div>
            <h4 className="text-white font-light text-lg mb-4">Personalized Routine Tips</h4>
            <div className="space-y-3">
              {analysisResult.routine_suggestions.map((suggestion, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="text-luxury-gold mt-1">•</span>
                  <p className="text-luxury-gray text-sm">{suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-luxury-black-soft border border-luxury-gold border-opacity-20 p-8">
      <div className="mb-8">
        <p className="text-luxury-gold text-xs uppercase tracking-wider mb-2">AI SKIN ANALYSIS</p>
        <h3 className="text-2xl font-light text-white">Personalized Product Matching</h3>
        <p className="text-luxury-gray mt-2">
          Get AI-powered recommendations tailored to your unique skin profile
        </p>
      </div>

      <div className="space-y-8">
        {/* Skin Type Selection */}
        <div>
          <label className="block text-luxury-gray text-sm uppercase tracking-wider mb-4">
            What's your skin type?
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skinTypes.map((type) => (
              <label key={type.id} className="cursor-pointer">
                <input
                  type="radio"
                  name="skinType"
                  value={type.id}
                  checked={formData.skinType === type.id}
                  onChange={(e) => setFormData(prev => ({ ...prev, skinType: e.target.value }))}
                  className="sr-only"
                />
                <div className={`border p-4 transition-all duration-300 ${
                  formData.skinType === type.id
                    ? 'border-luxury-gold bg-luxury-gold bg-opacity-5'
                    : 'border-luxury-gold border-opacity-20 hover:border-opacity-40'
                }`}>
                  <h4 className="text-white font-light mb-2">{type.label}</h4>
                  <p className="text-luxury-gray text-sm">{type.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Primary Concerns */}
        <div>
          <label className="block text-luxury-gray text-sm uppercase tracking-wider mb-4">
            What are your main skin concerns? (Select all that apply)
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {concerns.map((concern) => (
              <label key={concern} className="cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.primaryConcerns.includes(concern)}
                  onChange={() => handleConcernToggle(concern)}
                  className="sr-only"
                />
                <div className={`border p-3 text-center transition-all duration-300 ${
                  formData.primaryConcerns.includes(concern)
                    ? 'border-luxury-gold bg-luxury-gold bg-opacity-5 text-luxury-gold'
                    : 'border-luxury-gold border-opacity-20 text-luxury-gray hover:border-opacity-40 hover:text-luxury-gold'
                }`}>
                  <span className="text-sm">{concern}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Additional Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-luxury-gray text-sm uppercase tracking-wider mb-2">
              Current Products (Optional)
            </label>
            <textarea
              value={formData.currentProducts}
              onChange={(e) => setFormData(prev => ({ ...prev, currentProducts: e.target.value }))}
              placeholder="List any products you're currently using..."
              rows={3}
              className="w-full bg-transparent border border-luxury-gold border-opacity-30 text-white px-4 py-3 focus:border-luxury-gold focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-luxury-gray text-sm uppercase tracking-wider mb-2">
              Known Allergies (Optional)
            </label>
            <textarea
              value={formData.allergies}
              onChange={(e) => setFormData(prev => ({ ...prev, allergies: e.target.value }))}
              placeholder="Any known ingredient allergies or sensitivities..."
              rows={3}
              className="w-full bg-transparent border border-luxury-gold border-opacity-30 text-white px-4 py-3 focus:border-luxury-gold focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="text-center pt-6">
          <button
            onClick={handleAnalysis}
            disabled={!formData.skinType || formData.primaryConcerns.length === 0}
            className="bg-luxury-gold text-black px-8 py-3 text-sm uppercase tracking-wider font-medium hover:bg-opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ANALYZE MY SKIN
          </button>
          <p className="text-luxury-gray text-xs mt-3">
            Analysis takes 30-60 seconds • Results include personalized product recommendations
          </p>
        </div>
      </div>
    </div>
  );
}