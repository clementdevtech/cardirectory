import { v2 as cloudinary } from "cloudinary";

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
  export const uploadLogoToR2 = async (base64String: string) => {
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
};
