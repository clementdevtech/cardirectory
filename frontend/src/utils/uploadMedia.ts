import { supabase } from '@/integrations/supabase/client';

export const uploadDealerMedia = async (file: File, type: 'image' | 'video') => {
  const bucket = type === 'image' ? 'dealer-images' : 'dealer-videos';
  const fileName = `${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, { upsert: true });

  if (error) throw error;

  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
};
