import React, { useEffect, useState } from "react";

type Props = {
  images: string[];
  videoUrl?: string | null;
  alt: string;
  className?: string;
};

const CarCardMedia: React.FC<Props> = ({ images, videoUrl, alt, className = "" }) => {
  const safeImages = images.length ? images : ["/placeholder-car.jpg"];
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [videoUrl, images.join("|")]);

  useEffect(() => {
    if (videoUrl || safeImages.length < 2) return;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % safeImages.length);
    }, 3500);

    return () => window.clearInterval(interval);
  }, [videoUrl, safeImages.length]);

  if (videoUrl) {
    return (
      <video
        src={videoUrl}
        autoPlay
        muted
        loop
        playsInline
        controls
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      {safeImages.map((image, index) => (
        <img
          key={`${image}-${index}`}
          src={image}
          alt={alt}
          onError={(event) => {
            event.currentTarget.src = "/placeholder-car.jpg";
          }}
          className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-out ${
            index === activeIndex
              ? "scale-100 opacity-100"
              : "scale-105 opacity-0"
          }`}
        />
      ))}

      {safeImages.length > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/35 px-2 py-1">
          {safeImages.map((image, index) => (
            <span
              key={`${image}-dot-${index}`}
              className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                index === activeIndex ? "bg-white" : "bg-white/45"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CarCardMedia;
