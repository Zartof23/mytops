import { createClient } from "jsr:@supabase/supabase-js@2";

// Helper: Download and store image (uses service role for storage)
export async function downloadAndStoreImage(
  imageUrl: string,
  topicSlug: string,
  itemSlug: string
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error('Failed to download image:', response.statusText);
      return null;
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const filePath = `${topicSlug}/${itemSlug}.webp`;
    const { data, error } = await supabaseServiceRole.storage
      .from('item-images')
      .upload(filePath, uint8Array, {
        contentType: 'image/webp',
        upsert: true
      });

    if (error) {
      console.error('Failed to upload image:', error);
      return null;
    }

    const { data: urlData } = supabaseServiceRole.storage
      .from('item-images')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in downloadAndStoreImage:', error);
    return null;
  }
}
