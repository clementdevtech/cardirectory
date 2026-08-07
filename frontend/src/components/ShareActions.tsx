import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Facebook, Instagram, Share2, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  facebookShareUrl,
  fetchImageFile,
  shareViaWebShare,
  whatsappShareUrl,
  copyTextToClipboard,
} from "@/lib/utils";

interface ShareActionsProps {
  carId: number;
  title: string;
  description: string;
  imageUrl: string;
  url?: string;
  compact?: boolean;
}

const ShareActions: React.FC<ShareActionsProps> = ({
  carId,
  title,
  description,
  imageUrl,
  url,
  compact = false,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const shareUrl =
    url
      ? typeof window !== "undefined"
        ? new URL(url, window.location.origin).toString()
        : url
      : typeof window !== "undefined"
      ? new URL(`/cars/${carId}`, window.location.origin).toString()
      : "";

  const sharedText = `${description} ${shareUrl}`;

  const handleFacebookShare = () => {
    window.open(
      facebookShareUrl(shareUrl, description),
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleWhatsappShare = () => {
    window.open(
      whatsappShareUrl(description, shareUrl),
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleNativeShare = async (platform: string) => {
    if (!navigator.share) {
      toast({
        title: `${platform} share unavailable`,
        description: "Your browser does not support native sharing.",
      });
      return;
    }

    setLoading(platform);
    try {
      const imageFile = await fetchImageFile(imageUrl);
      await shareViaWebShare({
        title,
        text: description,
        url: shareUrl,
        imageUrl,
        file: imageFile ?? undefined,
      });
      toast({
        title: `Share via ${platform}`,
        description: "Select the app from your share sheet.",
      });
    } catch (error) {
      toast({
        title: `Could not share to ${platform}`,
        description:
          "Try copying the link and sharing it directly in the app.",
      });
    } finally {
      setLoading(null);
    }
  };

  const handleCopyLink = async () => {
    const copied = await copyTextToClipboard(shareUrl);
    toast({
      title: copied ? "Link copied" : "Copy failed",
      description: copied
        ? "You can now paste the link into any app."
        : "Please copy the link manually.",
    });
  };

  const wrapperClassName = compact
    ? "flex flex-wrap gap-1 mt-3"
    : "flex flex-wrap gap-2 mt-3";

  const buttonClassName = compact
    ? "gap-1 text-[11px] px-2 py-1"
    : "gap-2";

  return (
    <div className={wrapperClassName}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleFacebookShare}
        className={buttonClassName}
      >
        <Facebook className="w-4 h-4" /> Facebook
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleWhatsappShare}
        className={buttonClassName}
      >
        <Share2 className="w-4 h-4" /> WhatsApp
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleNativeShare("Instagram")}
        disabled={Boolean(loading)}
        className={buttonClassName}
      >
        <Instagram className="w-4 h-4" /> Instagram
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleNativeShare("TikTok")}
        disabled={Boolean(loading)}
        className={buttonClassName}
      >
        <Video className="w-4 h-4" /> TikTok
      </Button>
      <Button
        variant={compact ? "outline" : "ghost"}
        size="sm"
        onClick={handleCopyLink}
        className={buttonClassName}
      >
        <Copy className="w-4 h-4" /> Copy
      </Button>
    </div>
  );
};

export default ShareActions;
