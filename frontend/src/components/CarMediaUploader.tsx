import React, { useState } from "react";
import { uploadToCloudinary } from "@/utils/cloudinaryUpload";

interface Props {
  onUploadComplete: (urls: { gallery: string[]; video_url: string | null }) => void;
}

export default function CarMediaUploader({ onUploadComplete }: Props) {
  const [images, setImages] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    try {
      setLoading(true);
      const galleryUrls: string[] = [];

      // Upload all images
      for (const file of images) {
        const url = await uploadToCloudinary(file, "image", (p) =>
          setProgress((prev) => ({ ...prev, [file.name]: p }))
        );
        galleryUrls.push(url);
      }

      // Upload video (optional)
      let videoUrl: string | null = null;
      if (video) {
        videoUrl = await uploadToCloudinary(video, "video", (p) =>
          setProgress((prev) => ({ ...prev, [video.name]: p }))
        );
      }

      onUploadComplete({ gallery: galleryUrls, video_url: videoUrl });
      alert("✅ Upload complete!");
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="font-semibold">Upload Car Images</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setImages(Array.from(e.target.files || []))}
          className="mt-1"
        />

        {images.map((img) => (
          <div key={img.name} className="mt-2 flex items-center gap-3">
            <img
              src={URL.createObjectURL(img)}
              alt={img.name}
              className="w-20 h-20 object-cover rounded"
            />
            <div className="w-full bg-gray-200 rounded h-2">
              <div
                className="bg-green-600 h-2 rounded"
                style={{ width: `${progress[img.name] || 0}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="font-semibold">Upload Video (optional)</label>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setVideo(e.target.files?.[0] || null)}
          className="mt-1"
        />

        {video && (
          <div className="mt-2">
            <video
              src={URL.createObjectURL(video)}
              controls
              className="rounded-md w-full max-h-56"
            />
            <div className="w-full bg-gray-200 rounded h-2 mt-2">
              <div
                className="bg-blue-600 h-2 rounded"
                style={{ width: `${progress[video.name] || 0}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      <button
        disabled={loading}
        onClick={handleUpload}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {loading ? "Uploading..." : "Start Upload"}
      </button>
    </div>
  );
}
