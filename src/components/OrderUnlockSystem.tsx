'use client';

import React, { useState, useEffect } from 'react';
import { trackOrderUnlockProgress, trackSocialShareCompleted, trackOrderUnlocked } from './AnalyticsTracker';

interface OrderUnlockSystemProps {
  customerEmail?: string;
  orderNumber?: number;
  previousSavings?: number;
  onUnlockComplete: (unlockData: UnlockData) => void;
}

interface UnlockData {
  socialProof: {
    platform: string;
    postUrl?: string;
    screenshotUploaded: boolean;
    sharingTimestamp: number;
  };
  unlockStatus: 'locked' | 'pending' | 'unlocked';
  nextOrderDiscount: number;
}

interface SocialShareMethod {
  id: string;
  platform: string;
  icon: string;
  title: string;
  description: string;
  isRequired: boolean;
  unlockValue: number; // Points toward unlock
}

const SOCIAL_SHARE_METHODS: SocialShareMethod[] = [
  {
    id: 'instagram-story',
    platform: 'Instagram',
    icon: '📸',
    title: 'Instagram Story',
    description: 'Share your savings on your Instagram Story and tag @seoulsister',
    isRequired: true,
    unlockValue: 50
  },
  {
    id: 'instagram-post',
    platform: 'Instagram',
    icon: '📷',
    title: 'Instagram Post',
    description: 'Create a post showing your Seoul Sister haul with #SeoulSister',
    isRequired: false,
    unlockValue: 30
  },
  {
    id: 'tiktok-video',
    platform: 'TikTok',
    icon: '🎵',
    title: 'TikTok Video',
    description: 'Make a TikTok exposing beauty industry markup with your savings',
    isRequired: false,
    unlockValue: 40
  },
  {
    id: 'friend-referral',
    platform: 'Referral',
    icon: '👥',
    title: 'Refer 3 Friends',
    description: 'Share Seoul Sister with 3 friends who love K-beauty',
    isRequired: false,
    unlockValue: 35
  }
];

export default function OrderUnlockSystem({
  customerEmail,
  orderNumber = 1,
  previousSavings = 0,
  onUnlockComplete
}: OrderUnlockSystemProps) {
  const [unlockProgress, setUnlockProgress] = useState(0);
  const [completedShares, setCompletedShares] = useState<string[]>([]);
  const [uploadedScreenshots, setUploadedScreenshots] = useState<{[key: string]: File}>({});
  const [unlockStatus, setUnlockStatus] = useState<'locked' | 'pending' | 'unlocked'>('locked');
  const [showUploadModal, setShowUploadModal] = useState<string | null>(null);

  const REQUIRED_POINTS = 100;

  useEffect(() => {
    const totalPoints = completedShares.reduce((sum, shareId) => {
      const method = SOCIAL_SHARE_METHODS.find(m => m.id === shareId);
      return sum + (method?.unlockValue || 0);
    }, 0);

    setUnlockProgress(totalPoints);

    // Track progress
    trackOrderUnlockProgress({
      progress: totalPoints,
      required: REQUIRED_POINTS,
      completed_shares: completedShares.length,
      status: totalPoints >= REQUIRED_POINTS && completedShares.includes('instagram-story') ? 'unlocked' :
              totalPoints > 0 ? 'pending' : 'locked'
    });

    if (totalPoints >= REQUIRED_POINTS && completedShares.includes('instagram-story')) {
      const wasLocked = unlockStatus !== 'unlocked';
      setUnlockStatus('unlocked');

      const unlockData: UnlockData = {
        socialProof: {
          platform: 'multiple',
          screenshotUploaded: Object.keys(uploadedScreenshots).length > 0,
          sharingTimestamp: Date.now()
        },
        unlockStatus: 'unlocked' as const,
        nextOrderDiscount: Math.min(Math.floor(totalPoints / 10), 25) // Up to 25% discount
      };

      onUnlockComplete(unlockData);

      // Track unlock completion (only once)
      if (wasLocked) {
        trackOrderUnlocked({
          ...unlockData,
          totalShares: completedShares.length,
          timeToUnlock: Math.round((Date.now() - (Date.now() - 300000)) / (1000 * 60)) // Estimated 5 min for demo
        });
      }
    } else if (totalPoints > 0) {
      setUnlockStatus('pending');
    }
  }, [completedShares, uploadedScreenshots, onUnlockComplete]);

  const handleShareComplete = (shareId: string) => {
    if (!completedShares.includes(shareId)) {
      setCompletedShares([...completedShares, shareId]);

      // Track individual share completion
      const shareMethod = SOCIAL_SHARE_METHODS.find(m => m.id === shareId);
      if (shareMethod) {
        trackSocialShareCompleted({
          platform: shareMethod.platform,
          type: shareMethod.title,
          points: shareMethod.unlockValue,
          hasScreenshot: !!uploadedScreenshots[shareId]
        });
      }
    }
  };

  const handleScreenshotUpload = (shareId: string, file: File) => {
    setUploadedScreenshots({
      ...uploadedScreenshots,
      [shareId]: file
    });
    setShowUploadModal(null);
    handleShareComplete(shareId);
  };

  const openShareModal = (method: SocialShareMethod) => {
    setShowUploadModal(method.id);
  };

  const getShareInstructions = (method: SocialShareMethod) => {
    switch (method.id) {
      case 'instagram-story':
        return [
          "1. Use our viral screenshot generator to create your story image",
          "2. Upload to your Instagram Story",
          "3. Tag @seoulsister and use #SeoulSister #KBeauty",
          "4. Take a screenshot of your published story",
          "5. Upload the screenshot here to unlock your next order"
        ];
      case 'instagram-post':
        return [
          "1. Create a post with your Seoul Sister products",
          "2. Use caption: 'Exposing the beauty industry markup with @seoulsister'",
          "3. Include hashtags: #SeoulSister #KBeauty #BeautyScam",
          "4. Screenshot your published post",
          "5. Upload screenshot here"
        ];
      case 'tiktok-video':
        return [
          "1. Create a TikTok showing US vs Seoul prices",
          "2. Use trending audio and include text overlay",
          "3. Hashtags: #SeoulSister #BeautyHack #KBeauty",
          "4. Screenshot your published video",
          "5. Upload screenshot here"
        ];
      case 'friend-referral':
        return [
          "1. Share seoulsister.com with 3 friends who love K-beauty",
          "2. Send them your custom referral link",
          "3. When they sign up, you'll get credit automatically",
          "4. Track progress in your dashboard",
          "5. Full credit unlocked when all 3 sign up"
        ];
      default:
        return ["Follow the platform-specific instructions to complete this share."];
    }
  };

  const getProgressColor = () => {
    if (unlockProgress >= REQUIRED_POINTS) return 'bg-green-500';
    if (unlockProgress >= 50) return 'bg-yellow-500';
    return 'bg-korean-red';
  };

  const getStatusMessage = () => {
    if (unlockStatus === 'unlocked') {
      return {
        title: "🎉 Next Order Unlocked!",
        message: `Congratulations! You've earned a ${Math.min(Math.floor(unlockProgress / 10), 25)}% discount on your next order.`,
        color: "text-green-600"
      };
    }
    if (unlockStatus === 'pending') {
      return {
        title: "⏳ Almost There!",
        message: `You need ${REQUIRED_POINTS - unlockProgress} more points to unlock your next order.`,
        color: "text-yellow-600"
      };
    }
    return {
      title: "🔒 Order #2 Locked",
      message: "Share your Seoul Sister savings to unlock future orders and join the beauty revolution!",
      color: "text-gray-600"
    };
  };

  const status = getStatusMessage();

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-gradient max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h3 className="text-3xl font-bold text-gray-900 mb-2">
          Unlock Your Next Seoul Sister Order 🔓
        </h3>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Help expose the beauty industry scam by sharing your savings! Complete sharing tasks to unlock future orders with exclusive discounts.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-gray-700">Unlock Progress</span>
          <span className="text-sm font-semibold text-gray-700">{unlockProgress}/{REQUIRED_POINTS} points</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all duration-500 ${getProgressColor()}`}
            style={{ width: `${Math.min((unlockProgress / REQUIRED_POINTS) * 100, 100)}%` }}
          ></div>
        </div>
        <div className="text-center mt-4">
          <p className={`text-lg font-semibold ${status.color}`}>{status.title}</p>
          <p className="text-sm text-gray-600">{status.message}</p>
        </div>
      </div>

      {/* Sharing Tasks */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {SOCIAL_SHARE_METHODS.map((method) => {
          const isCompleted = completedShares.includes(method.id);
          const hasScreenshot = uploadedScreenshots[method.id];

          return (
            <div
              key={method.id}
              className={`p-6 rounded-xl border-2 transition-all ${
                isCompleted
                  ? 'border-green-500 bg-green-50'
                  : method.isRequired
                  ? 'border-korean-red bg-red-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{method.icon}</span>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {method.title}
                      {method.isRequired && <span className="text-korean-red ml-1">*</span>}
                    </h4>
                    <p className="text-sm text-gray-600">{method.platform}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-korean-blue">+{method.unlockValue}</div>
                  <div className="text-xs text-gray-500">points</div>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">{method.description}</p>

              <div className="flex items-center justify-between">
                {isCompleted ? (
                  <div className="flex items-center text-green-600">
                    <span className="mr-2">✅</span>
                    <span className="text-sm font-semibold">Completed</span>
                  </div>
                ) : (
                  <button
                    onClick={() => openShareModal(method)}
                    className="bg-korean-gradient text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
                  >
                    Start Sharing
                  </button>
                )}

                {hasScreenshot && (
                  <div className="text-xs text-green-600">📄 Screenshot uploaded</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Required Notice */}
      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ Required:</strong> Instagram Story sharing is mandatory to unlock future orders.
          Other sharing methods provide bonus points and higher discounts!
        </p>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-xl font-bold text-gray-900">
                {SOCIAL_SHARE_METHODS.find(m => m.id === showUploadModal)?.title} Instructions
              </h4>
              <button
                onClick={() => setShowUploadModal(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mb-6">
              <ol className="space-y-2">
                {getShareInstructions(SOCIAL_SHARE_METHODS.find(m => m.id === showUploadModal)!).map((step, index) => (
                  <li key={index} className="text-sm text-gray-700">{step}</li>
                ))}
              </ol>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Upload Screenshot of Your Share
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && showUploadModal) {
                    handleScreenshotUpload(showUploadModal, file);
                  }
                }}
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-korean-red focus:ring-0"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  if (showUploadModal) {
                    handleShareComplete(showUploadModal);
                  }
                }}
                className="flex-1 bg-korean-gradient text-white py-3 px-6 rounded-xl font-semibold hover:opacity-90 transition-opacity"
              >
                I've Shared (No Screenshot)
              </button>
              <button
                onClick={() => setShowUploadModal(null)}
                className="flex-1 bg-gray-200 text-gray-800 py-3 px-6 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {unlockStatus === 'unlocked' && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center">
          <h4 className="text-xl font-bold text-green-800 mb-2">🎉 Welcome to the Seoul Sister Revolution!</h4>
          <p className="text-green-700 mb-4">
            You've successfully exposed the beauty industry scam and helped others discover authentic Seoul prices!
          </p>
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <p className="text-sm text-gray-600 mb-2">Your next order benefits:</p>
            <ul className="text-sm text-green-700 space-y-1">
              <li>✅ {Math.min(Math.floor(unlockProgress / 10), 25)}% discount on all products</li>
              <li>✅ Priority processing and faster shipping</li>
              <li>✅ Access to exclusive Seoul Sister member products</li>
              <li>✅ Early access to new Korean beauty drops</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}