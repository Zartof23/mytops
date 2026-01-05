-- Add RLS policies for storage buckets to allow public read access
-- Migration created: 2026-01-05

-- Public read access for topic-images bucket
CREATE POLICY "Public read access for topic images"
ON storage.objects FOR SELECT
USING (bucket_id = 'topic-images');

-- Public read access for item-images bucket
CREATE POLICY "Public read access for item images"
ON storage.objects FOR SELECT
USING (bucket_id = 'item-images');

-- Service role insert access for topic-images bucket (for seeding)
CREATE POLICY "Service role insert for topic images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'topic-images'
  AND auth.role() = 'service_role'
);

-- Service role insert access for item-images bucket (for seeding)
CREATE POLICY "Service role insert for item images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'item-images'
  AND auth.role() = 'service_role'
);
