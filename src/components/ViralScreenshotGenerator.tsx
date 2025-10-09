'use client';

import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import InstagramStoryShare from './InstagramStoryShare';
import { trackViralScreenshotGenerated, trackViralScreenshotShared } from './AnalyticsTracker';

interface SavingsData {
  productName: string;
  usPrice: number;
  seoulPrice: number;
  savings: number;
  savingsPercent: number;
  brand: string;
}

interface ViralScreenshotGeneratorProps {
  savingsData: SavingsData;
  customerName?: string;
  onScreenshotGenerated: (imageDataUrl: string) => void;
}

export default function ViralScreenshotGenerator({
  savingsData,
  customerName = "Seoul Sister",
  onScreenshotGenerated
}: ViralScreenshotGeneratorProps) {
  const screenshotRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const generateScreenshot = async () => {
    if (!screenshotRef.current) return;

    setIsGenerating(true);

    try {
      const canvas = await html2canvas(screenshotRef.current, {
        backgroundColor: '#f8f9fa',
        scale: 2,
        width: 1080,
        height: 1920,
        useCORS: true,
        allowTaint: true,
      });

      const imageDataUrl = canvas.toDataURL('image/png', 1.0);
      setGeneratedImage(imageDataUrl);
      setShowShareModal(true);
      onScreenshotGenerated(imageDataUrl);

      // Track screenshot generation
      trackViralScreenshotGenerated(savingsData);
    } catch (error) {
      console.error('Screenshot generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const viralMessages = [
    `POV: You discover what Seoul girls actually pay 😱`,
    `bestie I'm SHOOK by these Seoul prices 💅`,
    `This Seoul markup exposure is INSANE ✨`,
    `No cap these Seoul prices are incredible 🔥`,
    `Seoul Sisters really said NO to US markups 💋`
  ];

  const randomViralMessage = viralMessages[Math.floor(Math.random() * viralMessages.length)];

  return (
    <div className="viral-screenshot-container">
      {/* Instagram Story Screenshot Template */}
      <div
        ref={screenshotRef}
        className="instagram-story-template"
        style={{
          width: '1080px',
          height: '1920px',
          background: 'linear-gradient(135deg, #ffd700, #e8b4a0, #a3c7e1)',
          position: 'relative',
          fontFamily: '"SF Pro Display", "Inter", -apple-system, sans-serif',
          color: '#1d1d1f',
          padding: '60px 40px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
          <div style={{
            fontSize: '72px',
            fontWeight: '800',
            background: 'linear-gradient(135deg, #ffd700, #ffed4e, #ffd700)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '20px',
            textShadow: '0 4px 8px rgba(255, 215, 0, 0.3)',
            letterSpacing: '-2px'
          }}>
            Seoul Sister
          </div>
          <div style={{
            fontSize: '42px',
            fontWeight: '600',
            color: '#1d1d1f',
            opacity: '0.9',
            letterSpacing: '-1px'
          }}>
            {randomViralMessage}
          </div>
        </div>

        {/* Product Info */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '32px',
          padding: '60px 50px',
          textAlign: 'center',
          border: '3px solid rgba(255, 215, 0, 0.6)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          backdropFilter: 'blur(20px)',
          margin: '40px 0'
        }}>
          <div style={{
            fontSize: '48px',
            fontWeight: '700',
            color: '#1d1d1f',
            marginBottom: '20px',
            letterSpacing: '-1px'
          }}>
            {savingsData.productName}
          </div>
          <div style={{
            fontSize: '32px',
            color: '#666',
            marginBottom: '50px',
            fontWeight: '500'
          }}>
            {savingsData.brand}
          </div>

          {/* Price Comparison */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            margin: '60px 0'
          }}>
            {/* US Price */}
            <div style={{
              background: 'rgba(124, 45, 18, 0.1)',
              borderRadius: '24px',
              padding: '40px 30px',
              border: '3px solid #7c2d12',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '28px',
                fontWeight: '600',
                color: '#7c2d12',
                marginBottom: '15px',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                US RETAIL
              </div>
              <div style={{
                fontSize: '64px',
                fontWeight: '800',
                color: '#7c2d12',
                textDecoration: 'line-through',
                position: 'relative'
              }}>
                ${savingsData.usPrice}
              </div>
            </div>

            {/* Arrow */}
            <div style={{
              fontSize: '80px',
              color: '#ffd700',
              fontWeight: '800'
            }}>
              →
            </div>

            {/* Seoul Price */}
            <div style={{
              background: 'rgba(22, 101, 52, 0.1)',
              borderRadius: '24px',
              padding: '40px 30px',
              border: '3px solid #166534',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '28px',
                fontWeight: '600',
                color: '#166534',
                marginBottom: '15px',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                SEOUL PRICE
              </div>
              <div style={{
                fontSize: '64px',
                fontWeight: '800',
                background: 'linear-gradient(135deg, #ffd700, #e8b4a0)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 2px 4px rgba(255, 215, 0, 0.3))'
              }}>
                ${savingsData.seoulPrice}
              </div>
            </div>
          </div>

          {/* Savings Badge */}
          <div style={{
            background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
            color: '#1d1d1f',
            padding: '30px 60px',
            borderRadius: '50px',
            fontSize: '48px',
            fontWeight: '800',
            textAlign: 'center',
            border: '4px solid #b8860b',
            boxShadow: '0 12px 30px rgba(255, 215, 0, 0.6)',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
            marginTop: '40px'
          }}>
            SAVED ${savingsData.savings}!
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <div style={{
            fontSize: '36px',
            fontWeight: '600',
            color: '#1d1d1f',
            marginBottom: '20px'
          }}>
            Join the Seoul Sister Revolution
          </div>
          <div style={{
            fontSize: '28px',
            color: '#666',
            fontWeight: '500'
          }}>
            SeoulSister.com
          </div>
          <div style={{
            fontSize: '24px',
            color: '#666',
            marginTop: '15px',
            opacity: '0.8'
          }}>
            #SeoulSister #KBeauty #SeoulPrices
          </div>
        </div>

        {/* Sparkle Effects */}
        <div style={{
          position: 'absolute',
          top: '200px',
          right: '100px',
          fontSize: '60px',
          opacity: '0.8',
          animation: 'sparkle 2s ease-in-out infinite alternate'
        }}>
          ✨
        </div>
        <div style={{
          position: 'absolute',
          bottom: '300px',
          left: '80px',
          fontSize: '50px',
          opacity: '0.6',
          animation: 'sparkle 2.5s ease-in-out infinite alternate'
        }}>
          💅
        </div>
        <div style={{
          position: 'absolute',
          top: '800px',
          left: '100px',
          fontSize: '45px',
          opacity: '0.7',
          animation: 'sparkle 3s ease-in-out infinite alternate'
        }}>
          👑
        </div>
      </div>

      {/* Generate Button */}
      <div style={{ textAlign: 'center', marginTop: '40px' }}>
        <button
          onClick={generateScreenshot}
          disabled={isGenerating}
          style={{
            background: 'linear-gradient(135deg, #1d1d1f, #2a2a2a)',
            color: 'white',
            border: '2px solid #ffd700',
            borderRadius: '24px',
            padding: '16px 32px',
            fontSize: '18px',
            fontWeight: '700',
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            boxShadow: '0 8px 24px rgba(255, 215, 0, 0.4)',
            transition: 'all 0.3s ease'
          }}
        >
          {isGenerating ? 'Generating Your Viral Moment...' : 'Generate Seoul Sister Screenshot ✨'}
        </button>
      </div>

      <style jsx>{`
        @keyframes sparkle {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.6; }
          50% { transform: scale(1.2) rotate(5deg); opacity: 1; }
        }

        .instagram-story-template {
          transform-origin: top left;
          transform: scale(0.3);
        }

        @media (max-width: 768px) {
          .instagram-story-template {
            transform: scale(0.2);
          }
        }
      `}</style>

      {/* Instagram Share Modal */}
      {showShareModal && generatedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute -top-4 -right-4 bg-white rounded-full w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-800 z-10 shadow-lg"
            >
              ✕
            </button>
            <InstagramStoryShare
              imageDataUrl={generatedImage}
              productName={savingsData.productName}
              savings={savingsData.savings}
              onShare={() => {
                setShowShareModal(false);
                // Track sharing event for analytics
                if (typeof window !== 'undefined' && (window as any).gtag) {
                  (window as any).gtag('event', 'share', {
                    method: 'instagram_story',
                    content_type: 'image',
                    item_id: savingsData.productName
                  });
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}