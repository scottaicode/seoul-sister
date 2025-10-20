-- Add content_type column to influencer_content table
-- This column is needed to store whether content is 'image', 'video', or 'carousel'

ALTER TABLE influencer_content
ADD COLUMN IF NOT EXISTS content_type TEXT CHECK (content_type IN ('image', 'video', 'carousel')) DEFAULT 'image';

-- Update existing records to have default content_type
UPDATE influencer_content
SET content_type = 'image'
WHERE content_type IS NULL;

-- Create index for content_type filtering
CREATE INDEX IF NOT EXISTS idx_influencer_content_type ON influencer_content(content_type);

-- Add comment to document the column
COMMENT ON COLUMN influencer_content.content_type IS 'Type of content: image, video, or carousel';