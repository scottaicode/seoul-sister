'use client';

import React, { useState, useEffect } from 'react';
import { trackViralCopyGenerated, trackViralCopyCopied } from './AnalyticsTracker';

interface ViralCopyData {
  productName: string;
  brand: string;
  usPrice: number;
  seoulPrice: number;
  savings: number;
  savingsPercent: number;
}

interface ViralCopyGeneratorProps {
  savingsData: ViralCopyData;
  onCopyGenerated: (copies: ViralCopy[]) => void;
}

interface ViralCopy {
  id: string;
  platform: 'instagram' | 'tiktok' | 'twitter' | 'general';
  style: 'shock' | 'educational' | 'relatable' | 'luxury' | 'rebellion';
  text: string;
  hashtags: string[];
  engagement_hooks: string[];
}

const VIRAL_TEMPLATES = {
  shock: {
    instagram: [
      "BESTIES I'M LITERALLY SHOOK 😱 {{brand}} {{product}} costs ${{usPrice}} at Sephora but I got it for ${{seoulPrice}} through Seoul Sister... {{savingsPercent}}% LESS! The beauty industry is SCAMMING us! 💅",
      "POV: You discover what Korean girls actually pay for {{brand}} 🤯 US retail: ${{usPrice}} ❌ Seoul price: ${{seoulPrice}} ✅ I'm saving ${{savings}} and I'm OBSESSED! 💋",
      "NOT ME CRYING because I've been paying ${{usPrice}} for {{product}} when Seoul Sisters get it for ${{seoulPrice}}... I'M DONE being finessed by beauty brands! 😭💅"
    ],
    tiktok: [
      "The way I GASPED when I found out {{brand}} {{product}} is ${{seoulPrice}} in Seoul but ${{usPrice}} in the US... bestie the AUDACITY 💀 #SeoulSister #KBeauty",
      "Tell me why I've been getting SCAMMED by Sephora when I could be getting {{brand}} for {{savingsPercent}}% less through Seoul Sister... THE BETRAYAL 😭",
      "Me realizing I could've saved ${{savings}} on my {{product}} this whole time: 🤡 Seoul Sister is exposing the beauty industry and I'm HERE for it! 👑"
    ],
    twitter: [
      "Y'all... {{brand}} {{product}} is ${{usPrice}} in the US but ${{seoulPrice}} in Seoul. We're literally being SCAMMED by the beauty industry. Seoul Sister is exposing this and I'm shook 😱",
      "The markup on K-beauty in the US is CRIMINAL. ${{savings}} difference for the SAME product? Seoul Sister is changing the game 💅",
      "Beauty brands really said 'let's charge Americans {{savingsPercent}}% more' and we just... accepted it? Not anymore. Seoul Sister is the revolution we needed 🔥"
    ]
  },
  educational: {
    instagram: [
      "Let me educate you bestie 📚 {{brand}} {{product}} costs ${{usPrice}} in the US because of distributor markups, retail margins, and marketing costs. In Seoul? ${{seoulPrice}}. Seoul Sister eliminates the middleman ✨",
      "Beauty industry math: Seoul price ${{seoulPrice}} + 300% markup = US price ${{usPrice}} 🧮 Seoul Sister said 'not today' and I saved ${{savings}}! Knowledge is power 💪",
      "Why {{brand}} costs more in the US: Import taxes ✓ Distributor markup ✓ Retail markup ✓ Marketing costs ✓ Seoul Sister: Direct sourcing ✓ Fair prices ✓ Happy customers ✓"
    ],
    tiktok: [
      "POV: You learn why K-beauty costs 300% more in the US 🤓 It's not the product, it's the system. Seoul Sister is disrupting the entire industry and I'm here for it! #EducateYourself",
      "Beauty brands when they realize Seoul Sister is exposing their markup strategy: 😰 Us when we realize we can save {{savingsPercent}}%: 😍 Knowledge is beautiful 💅",
      "Breaking down the ${{usPrice}} Sephora price: Product ${{seoulPrice}} + Greed ${{savings}} = Your broke bank account 💸 Seoul Sister said NO to this system!"
    ]
  },
  relatable: {
    instagram: [
      "Me: 'I can't afford good skincare' Also me: Paying ${{usPrice}} for {{product}} at Sephora 🤡 Seoul Sister really said 'girl, it's ${{seoulPrice}} in Seoul' and saved my budget AND my skin! 💅",
      "When your skincare routine costs more than your rent but Seoul Sister shows you the same {{brand}} products for {{savingsPercent}}% less... suddenly I can afford to glow ✨",
      "POV: You've been a broke beauty girlie because you didn't know about Seoul prices 😭 ${{savings}} saved on ONE product? My bank account is HEALING! 💳"
    ],
    tiktok: [
      "Me budgeting for skincare: $100 😭 Seoul Sister showing me Seoul prices: ${{seoulPrice}} 😍 My wallet: THANK YOU 🙏 The glow up is affordable bestie!",
      "When you realize you've been choosing between skincare and groceries because you didn't know about Seoul Sister... the BETRAYAL of not knowing sooner! 💔",
      "That moment when {{brand}} {{product}} goes from 'I can't afford it' to 'add to cart' because Seoul Sister said ${{seoulPrice}} instead of ${{usPrice}} 🛒✨"
    ]
  },
  luxury: {
    instagram: [
      "Luxury doesn't have to mean overpriced 💎 Getting my {{brand}} {{product}} for Seoul prices (${{seoulPrice}}) while maintaining the same quality? That's not just smart shopping, that's elevated living ✨",
      "The sophistication of knowing true value: {{brand}} at ${{seoulPrice}} through Seoul Sister versus ${{usPrice}} retail markup. This is how the informed shop 💅",
      "Real luxury is accessing authentic Korean beauty at fair prices. Seoul Sister connects you to Seoul's beauty culture, not inflated Western retail margins 🌸"
    ],
    tiktok: [
      "POV: You shop like the sophisticated beauty connoisseur you are 💅 {{brand}} for ${{seoulPrice}} through Seoul Sister vs ${{usPrice}} retail? The choice is obvious, darling ✨",
      "Elegance is knowing where to source quality. Seoul Sister provides direct access to Seoul's beauty market - because why pay middleman markup? 👑",
      "When you understand true value in beauty: Seoul price ${{seoulPrice}} ✓ Authentic sourcing ✓ Premium quality ✓ Seoul Sister making luxury accessible 💎"
    ]
  },
  rebellion: {
    instagram: [
      "TIRED of beauty brands treating us like ATMs? 💳 Seoul Sister is the REVOLUTION! Getting {{brand}} for ${{seoulPrice}} instead of ${{usPrice}}? That's ${{savings}} back in MY pocket! ✊",
      "Breaking: Local woman REFUSES to pay beauty industry markup, discovers Seoul Sister, saves {{savingsPercent}}% and looks incredible doing it 🔥 The beauty revolution starts with US!",
      "They don't want you to know about Seoul prices 🤫 But Seoul Sister said 'EXPOSE THE SCAM' and I'm here for it! {{brand}} {{product}}: ${{usPrice}} ❌ ${{seoulPrice}} ✅ We're taking back control! 💪"
    ],
    tiktok: [
      "Beauty brands when we discover Seoul Sister and stop paying their ridiculous markups: 😱 Us saving ${{savings}} per product: 😈 The revolution will be beautiful! 👑",
      "POV: You join the Seoul Sister movement and refuse to be scammed by beauty retailers ever again 💅 {{savingsPercent}}% savings hits different when it's YOUR money!",
      "Me watching beauty brands panic as Seoul Sister exposes their ${{savings}} markup on {{product}}: ☕️ This is what disruption looks like besties! 🔥"
    ],
    twitter: [
      "Seoul Sister is single-handedly dismantling the beauty industry's exploitative pricing model and I'm absolutely here for it. ${{savings}} saved on ONE product? Revolutionary. 🔥",
      "The beauty industry built an empire on overcharging us for Korean products. Seoul Sister said 'not today' and I saved {{savingsPercent}}% on {{brand}}. This is how change happens. ✊",
      "Breaking the beauty cartel one Seoul Sister order at a time. ${{usPrice}} → ${{seoulPrice}}. Same product, fair price. The revolution is beautiful. 💅"
    ]
  }
};

const TRENDING_HASHTAGS = {
  instagram: ['#SeoulSister', '#KBeauty', '#SeoulPrices', '#BeautyRevolution', '#SkincareScam', '#KBeautyHaul', '#SeoulStyle', '#BeautyCommunity', '#SkincareRoutine', '#GlowUp'],
  tiktok: ['#SeoulSister', '#KBeauty', '#BeautyHack', '#SkincareSecret', '#SeoulVibes', '#BeautyFinds', '#KBeautyTok', '#SkincareHaul', '#BeautyRevolution', '#GlowUp'],
  twitter: ['#SeoulSister', '#KBeauty', '#BeautyIndustry', '#SkincareScam', '#BeautyRevolution', '#ConsumerRights', '#FairPricing', '#KBeautyFinds'],
  general: ['#SeoulSister', '#KBeauty', '#SeoulPrices', '#BeautyFinds', '#SkincareDeals', '#AuthenticKBeauty']
};

const ENGAGEMENT_HOOKS = {
  shock: ['😱', '🤯', '💀', '😭', 'I'M SHOOK', 'BESTIE', 'NOT ME', 'THE AUDACITY'],
  educational: ['📚', '💡', '🤓', 'Let me educate you', 'Here's the tea', 'Knowledge is power', 'Breaking it down'],
  relatable: ['🤡', '😅', '💸', 'Me:', 'POV:', 'When you realize', 'That moment when'],
  luxury: ['💎', '✨', '👑', 'Sophistication', 'Elegance', 'Premium', 'Luxury'],
  rebellion: ['🔥', '✊', '💪', 'REVOLUTION', 'EXPOSE', 'SCAM', 'BREAKING', 'TIRED']
};

export default function ViralCopyGenerator({
  savingsData,
  onCopyGenerated
}: ViralCopyGeneratorProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<'all' | 'instagram' | 'tiktok' | 'twitter'>('all');
  const [selectedStyle, setSelectedStyle] = useState<'all' | 'shock' | 'educational' | 'relatable' | 'luxury' | 'rebellion'>('all');
  const [generatedCopies, setGeneratedCopies] = useState<ViralCopy[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const replacePlaceholders = (template: string): string => {
    return template
      .replace(/{{brand}}/g, savingsData.brand)
      .replace(/{{product}}/g, savingsData.productName)
      .replace(/{{usPrice}}/g, savingsData.usPrice.toString())
      .replace(/{{seoulPrice}}/g, savingsData.seoulPrice.toString())
      .replace(/{{savings}}/g, Math.round(savingsData.savings).toString())
      .replace(/{{savingsPercent}}/g, Math.round(savingsData.savingsPercent).toString());
  };

  const generateViralCopies = () => {
    setIsGenerating(true);

    const copies: ViralCopy[] = [];
    let copyId = 1;

    const platforms = selectedPlatform === 'all' ? ['instagram', 'tiktok', 'twitter'] : [selectedPlatform];
    const styles = selectedStyle === 'all' ? ['shock', 'educational', 'relatable', 'luxury', 'rebellion'] : [selectedStyle];

    platforms.forEach(platform => {
      if (platform === 'twitter') return; // Skip Twitter for now, focus on visual platforms

      styles.forEach(style => {
        const templates = VIRAL_TEMPLATES[style as keyof typeof VIRAL_TEMPLATES][platform as keyof typeof VIRAL_TEMPLATES.shock];

        templates?.forEach(template => {
          const processedText = replacePlaceholders(template);
          const platformHashtags = TRENDING_HASHTAGS[platform as keyof typeof TRENDING_HASHTAGS] || TRENDING_HASHTAGS.general;
          const styleHooks = ENGAGEMENT_HOOKS[style as keyof typeof ENGAGEMENT_HOOKS] || [];

          copies.push({
            id: `copy-${copyId++}`,
            platform: platform as ViralCopy['platform'],
            style: style as ViralCopy['style'],
            text: processedText,
            hashtags: platformHashtags.slice(0, 8),
            engagement_hooks: styleHooks.slice(0, 4)
          });
        });
      });
    });

    setTimeout(() => {
      setGeneratedCopies(copies);
      setIsGenerating(false);
      onCopyGenerated(copies);

      // Track copy generation
      trackViralCopyGenerated({
        platform: selectedPlatform,
        style: selectedStyle,
        copies_count: copies.length,
        product_name: savingsData.productName
      });
    }, 1500);
  };

  const copyToClipboard = (text: string, hashtags: string[], copyData: ViralCopy) => {
    const fullText = `${text}\n\n${hashtags.join(' ')}`;
    navigator.clipboard.writeText(fullText).then(() => {
      alert('Viral copy copied to clipboard! Ready to expose the beauty scam! 🔥');

      // Track copy usage
      trackViralCopyCopied({
        platform: copyData.platform,
        style: copyData.style,
        text: text,
        hashtags: hashtags
      });
    });
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram': return '📸';
      case 'tiktok': return '🎵';
      case 'twitter': return '🐦';
      default: return '📱';
    }
  };

  const getStyleEmoji = (style: string) => {
    switch (style) {
      case 'shock': return '😱';
      case 'educational': return '📚';
      case 'relatable': return '🤝';
      case 'luxury': return '💎';
      case 'rebellion': return '🔥';
      default: return '✨';
    }
  };

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-gradient">
      <div className="text-center mb-8">
        <h3 className="text-3xl font-bold text-gray-900 mb-2">
          Viral Copy Generator ✨
        </h3>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Generate platform-specific viral content to expose the beauty industry scam and share your Seoul Sister savings!
        </p>
      </div>

      {/* Controls */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Platform</label>
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value as any)}
            className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-korean-red focus:ring-0 transition-colors"
          >
            <option value="all">All Platforms</option>
            <option value="instagram">📸 Instagram</option>
            <option value="tiktok">🎵 TikTok</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Style</label>
          <select
            value={selectedStyle}
            onChange={(e) => setSelectedStyle(e.target.value as any)}
            className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-korean-red focus:ring-0 transition-colors"
          >
            <option value="all">All Styles</option>
            <option value="shock">😱 Shock & Awe</option>
            <option value="educational">📚 Educational</option>
            <option value="relatable">🤝 Relatable</option>
            <option value="luxury">💎 Luxury</option>
            <option value="rebellion">🔥 Rebellion</option>
          </select>
        </div>
      </div>

      {/* Generate Button */}
      <div className="text-center mb-8">
        <button
          onClick={generateViralCopies}
          disabled={isGenerating}
          className="bg-korean-gradient hover:opacity-90 transition-opacity text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50"
        >
          {isGenerating ? 'Generating Viral Content...' : 'Generate Viral Copies 🚀'}
        </button>
      </div>

      {/* Generated Copies */}
      {generatedCopies.length > 0 && (
        <div className="space-y-6">
          <h4 className="text-xl font-bold text-center text-gray-900 mb-6">
            Your Viral Content Arsenal ({generatedCopies.length} copies)
          </h4>

          <div className="grid gap-4">
            {generatedCopies.map((copy) => (
              <div key={copy.id} className="bg-gray-50 rounded-xl p-6 hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getPlatformIcon(copy.platform)}</span>
                    <span className="font-semibold text-gray-700 capitalize">{copy.platform}</span>
                    <span className="text-lg">{getStyleEmoji(copy.style)}</span>
                    <span className="text-sm text-gray-500 capitalize">{copy.style}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(copy.text, copy.hashtags, copy)}
                    className="bg-korean-gradient text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
                  >
                    Copy 📋
                  </button>
                </div>

                <p className="text-gray-800 mb-4 leading-relaxed">{copy.text}</p>

                <div className="flex flex-wrap gap-2 mb-3">
                  {copy.hashtags.slice(0, 6).map((hashtag, index) => (
                    <span
                      key={index}
                      className="text-xs bg-korean-gradient text-white px-2 py-1 rounded-full"
                    >
                      {hashtag}
                    </span>
                  ))}
                </div>

                <div className="text-xs text-gray-500">
                  Engagement hooks: {copy.engagement_hooks.join(', ')}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8 p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl">
            <p className="text-sm text-gray-600 mb-2">
              💡 <strong>Pro Tip:</strong> Use different copies across platforms for maximum reach!
            </p>
            <p className="text-xs text-gray-500">
              Tag @seoulsister and use #SeoulSister to join the revolution! 🔥
            </p>
          </div>
        </div>
      )}
    </div>
  );
}