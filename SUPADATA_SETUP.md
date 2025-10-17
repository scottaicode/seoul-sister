# SupaData API Key Setup Guide

## Steps to Get API Key

### 1. Sign Up for SupaData
1. Go to https://dash.supadata.ai
2. Create an account and complete onboarding
3. API key will be generated automatically

### 2. Get Your API Key
1. Login to SupaData dashboard
2. Find your API key in the dashboard
3. Copy the key (format will be provided in dashboard)

### 3. Update Environment File
Replace the placeholder in `.env.local`:
```bash
# Replace this placeholder:
SUPADATA_API_KEY=your_supadata_api_key_here

# With your real key from SupaData Dashboard:
SUPADATA_API_KEY=[YOUR_REAL_SUPADATA_KEY]
```

## Authentication Format
SupaData uses `x-api-key` header for authentication:
```bash
curl -H "x-api-key: YOUR_API_KEY" https://api.supadata.ai/v1/transcript
```

## Services Available
✅ Video transcription with Korean/English support
✅ YouTube metadata extraction
✅ Web content extraction
✅ Batch processing capabilities

## Current Implementation
Our SupaData service (`src/lib/services/supadata-service.ts`) is ready and includes:
- Video transcription with language detection
- Korean beauty keyword extraction
- Batch processing for multiple videos
- Trend analysis from transcriptions
- Quality metrics and confidence scoring

## Next Steps
1. Get API key from SupaData dashboard
2. Update `.env.local` with real key
3. Test transcription with Korean beauty TikTok videos
4. Integrate with Seoul Sister Intelligence pipeline