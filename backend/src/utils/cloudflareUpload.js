const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload dealer logo to Cloudinary
 * Accepts base64 string
 * Saves to folder: dealer_logos/
 */
async function uploadLogoToR2(base64String) {
  const base64Clean = base64String.replace(/^data:.+;base64,/, "");

  const result = await cloudinary.uploader.upload(
    `data:image/jpeg;base64,${base64Clean}`,
    {
      folder: "dealer_logos",
      upload_preset: process.env.VITE_CLOUDINARY_UPLOAD_PRESET,
      resource_type: "image",
    }
  );

  return result.secure_url;
}

module.exports = { uploadLogoToR2 };
