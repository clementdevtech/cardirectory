// src/hooks/useCarUploads.ts
import { useState } from "react";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;

type UploadProgress = { fileName: string; progress: number; url?: string };

export const useCarUploads = () => {
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreview, setGalleryPreview] = useState<string[]>([]);
  const [galleryProgress, setGalleryProgress] = useState<UploadProgress[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoProgress, setVideoProgress] = useState<UploadProgress | null>(null);

  const uploadWithProgress = (
    file: File,
    resourceType: "image" | "video",
    onProgress: (p: number) => void
  ): Promise<string> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
      xhr.open("POST", url);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url);
        } else {
          reject(new Error(`Cloudinary upload failed: ${xhr.statusText || xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);
      xhr.send(fd);
    });

  const selectGalleryFiles = (files: File[]) => {
    const clipped = files.slice(0, 8);
    setGalleryFiles(clipped);
    setGalleryPreview(clipped.map((f) => URL.createObjectURL(f)));
  };

  const uploadAssets = async () => {
    const galleryUrls = await Promise.all(
      galleryFiles.map((file) =>
        uploadWithProgress(file, "image", (progress) =>
          setGalleryProgress((prev) => [
            ...prev.filter((p) => p.fileName !== file.name),
            { fileName: file.name, progress },
          ])
        )
      )
    );

    let videoUrl = "";
    if (videoFile) {
      videoUrl = await uploadWithProgress(videoFile, "video", (progress) =>
        setVideoProgress({ fileName: videoFile.name, progress })
      );
    }

    return { galleryUrls, videoUrl };
  };

  const resetUploads = () => {
    setGalleryFiles([]);
    setGalleryPreview([]);
    setGalleryProgress([]);
    setVideoFile(null);
    setVideoProgress(null);
  };

  return {
    galleryFiles,
    galleryPreview,
    galleryProgress,
    videoFile,
    videoProgress,

    selectGalleryFiles,
    setVideoFile,
    uploadAssets,
    resetUploads,
  };
};
