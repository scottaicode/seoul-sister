'use client';

import { Shield, CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';

interface AuthenticityIconProps {
  iconType: string;
  riskColor: string;
  size?: number;
}

export default function AuthenticityIcon({ iconType, riskColor, size = 18 }: AuthenticityIconProps) {
  const getIcon = () => {
    switch (iconType) {
      case 'verified':
        return (
          <div className="relative">
            <Shield size={size} style={{ color: riskColor }} fill={`${riskColor}20`} />
            <CheckCircle
              size={size * 0.6}
              style={{ color: riskColor }}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            />
          </div>
        );

      case 'trusted':
        return (
          <div className="relative">
            <Shield size={size} style={{ color: riskColor }} fill={`${riskColor}15`} />
            <div
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full"
              style={{ backgroundColor: riskColor }}
            />
          </div>
        );

      case 'warning':
        return (
          <div className="relative">
            <div
              className="w-5 h-5 border-2 flex items-center justify-center"
              style={{
                borderColor: riskColor,
                backgroundColor: `${riskColor}10`,
                clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'
              }}
            >
              <div
                className="w-0.5 h-2 rounded-full"
                style={{ backgroundColor: riskColor }}
              />
            </div>
          </div>
        );

      case 'danger':
        return (
          <div className="relative">
            <div
              className="w-5 h-5 border-2 rounded flex items-center justify-center"
              style={{
                borderColor: riskColor,
                backgroundColor: `${riskColor}15`
              }}
            >
              <div
                className="text-xs font-bold"
                style={{ color: riskColor }}
              >
                !
              </div>
            </div>
          </div>
        );

      case 'blocked':
        return (
          <div className="relative">
            <div
              className="w-5 h-5 border-2 rounded-full flex items-center justify-center"
              style={{
                borderColor: riskColor,
                backgroundColor: `${riskColor}10`
              }}
            >
              <X size={size * 0.6} style={{ color: riskColor }} strokeWidth={3} />
            </div>
          </div>
        );

      default:
        return (
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: riskColor }}
          />
        );
    }
  };

  return (
    <div className="flex items-center justify-center">
      {getIcon()}
    </div>
  );
}