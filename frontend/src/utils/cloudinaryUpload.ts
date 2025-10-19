import axios from "axios";

export const uploadToCloudinary = async (
  file: File,
  resourceType: "image" | "video",
  onProgress?: (progress: number) => void
): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
  formData.append("cloud_name", import.meta.env.VITE_CLOUDINARY_CLOUD_NAME);

  const url = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

  const { data } = await axios.post(url, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (onProgress) {
        const percent = Math.round((e.loaded * 100) / (e.total || 1));
        onProgress(percent);
      }
    },
  });

  return data.secure_url as string;
};
