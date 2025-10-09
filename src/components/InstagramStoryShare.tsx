'use client';

import React, { useState } from 'react';
import { trackViralScreenshotShared } from './AnalyticsTracker';

interface InstagramStoryShareProps {
  imageDataUrl: string;
  productName: string;
  savings: number;
  onShare?: () => void;
}

export default function InstagramStoryShare({
  imageDataUrl,
  productName,
  savings,
  onShare
}: InstagramStoryShareProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [shareMethod, setShareMethod] = useState<'mobile' | 'desktop' | null>(null);

  // Detect if user is on mobile device
  const isMobile = typeof window !== 'undefined' &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const shareToInstagramStory = async () => {
    setIsSharing(true);

    try {
      if (isMobile) {
        // Mobile: Use Instagram's URL scheme to open in app
        const instagramUrl = `instagram://story-camera`;

        // First download the image to device
        const link = document.createElement('a');
        link.download = `seoul-sister-${productName.replace(/\s+/g, '-').toLowerCase()}-savings.png`;
        link.href = imageDataUrl;
        link.click();

        // Then try to open Instagram
        setTimeout(() => {
          window.location.href = instagramUrl;
        }, 1000);

        setShareMethod('mobile');

        // Track mobile Instagram share
        trackViralScreenshotShared('instagram', {
          productName,
          savings,
          method: 'mobile_instagram'
        });
      } else {
        // Desktop: Download image and show instructions
        const link = document.createElement('a');
        link.download = `seoul-sister-${productName.replace(/\s+/g, '-').toLowerCase()}-savings.png`;
        link.href = imageDataUrl;
        link.click();

        setShareMethod('desktop');

        // Track desktop download share
        trackViralScreenshotShared('download', {
          productName,
          savings,
          method: 'desktop_download'
        });
      }

      onShare?.();
    } catch (error) {
      console.error('Error sharing to Instagram:', error);
      alert('Error sharing to Instagram. Please try downloading the image manually.');
    } finally {
      setIsSharing(false);
    }
  };

  const shareToOtherPlatforms = () => {
    // Create shareable text
    const shareText = `OMG besties! 😱 I just discovered Seoul Sister and I'm SHOOK! Getting my ${productName} for $${savings} less than US retail... This K-beauty hack is INSANE! 💋✨ #SeoulSister #KBeauty #SeoulPrices`;

    // Download image
    const link = document.createElement('a');
    link.download = `seoul-sister-savings-${Date.now()}.png`;
    link.href = imageDataUrl;
    link.click();

    // Open native share if available
    if (navigator.share) {
      navigator.share({
        title: 'Seoul Sister Savings',
        text: shareText,
        url: 'https://seoulsister.com'
      });
    } else {
      // Fallback: Copy text to clipboard
      navigator.clipboard.writeText(shareText).then(() => {
        alert('Share text copied to clipboard! Post your downloaded image with this caption. 💅');
      });
    }
  };

  const copyLink = () => {
    const link = 'https://seoulsister.com';
    navigator.clipboard.writeText(link).then(() => {
      alert('Seoul Sister link copied! Share it to expose the beauty industry scam! 🔥');
    });
  };

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-gradient max-w-md mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Share Your Seoul Sister Moment! 💋
        </h3>
        <p className="text-gray-600">
          Help expose the beauty industry scam by sharing your savings!
        </p>
      </div>

      {/* Preview of generated image */}
      <div className="mb-6 text-center">
        <img
          src={imageDataUrl}
          alt="Seoul Sister Savings"
          className="w-24 h-32 object-cover rounded-lg mx-auto border-2 border-korean-red"
        />
        <p className="text-sm text-gray-500 mt-2">Your viral moment is ready! ✨</p>
      </div>

      {/* Share Buttons */}
      <div className="space-y-4">
        {/* Instagram Stories */}
        <button
          onClick={shareToInstagramStory}
          disabled={isSharing}
          className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50"
        >
          {isSharing ? 'Opening Instagram...' : '📸 Share to Instagram Stories'}
        </button>

        {/* Other Platforms */}
        <button
          onClick={shareToOtherPlatforms}
          className="w-full bg-korean-gradient text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
        >
          💅 Share Everywhere Else
        </button>

        {/* Copy Link */}
        <button
          onClick={copyLink}
          className="w-full bg-gray-100 text-gray-800 font-semibold py-3 px-6 rounded-xl hover:bg-gray-200 transition-colors duration-200"
        >
          🔗 Copy Seoul Sister Link
        </button>
      </div>

      {/* Share Instructions */}
      {shareMethod && (
        <div className="mt-6 p-4 bg-gray-50 rounded-xl">
          {shareMethod === 'mobile' ? (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Mobile Share Instructions:</h4>
              <ol className="text-sm text-gray-600 space-y-1">
                <li>1. Your image has been saved to your photos 📱</li>
                <li>2. Instagram should open automatically</li>
                <li>3. Upload your saved image to your Story</li>
                <li>4. Tag @seoulsister to expose the scam! 💋</li>
              </ol>
            </div>
          ) : (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Desktop Share Instructions:</h4>
              <ol className="text-sm text-gray-600 space-y-1">
                <li>1. Your image has been downloaded 💻</li>
                <li>2. Open Instagram on your phone</li>
                <li>3. Upload the image to your Story</li>
                <li>4. Tag @seoulsister and use #SeoulSister ✨</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Viral Tips */}
      <div className="mt-6 p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl">
        <h4 className="font-semibold text-gray-900 mb-2">💡 Viral Tips:</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Use hashtags: #SeoulSister #KBeauty #SeoulPrices</li>
          <li>• Tag @seoulsister for a chance to be featured</li>
          <li>• Share with friends who love K-beauty</li>
          <li>• Post when your followers are most active</li>
        </ul>
      </div>

      {/* Success Metrics */}
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          💫 Help us reach our goal: 10,000 Seoul Sisters exposing the beauty scam!
        </p>
      </div>
    </div>
  );
}