import { Request, Response } from "express";
import { query, pool } from "../db";
//import { v2 as cloudinary } from "cloudinary";

// 🚗 Fetch all cars with dealer info
export const getAllCars = async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT c.*, d.full_name AS dealer_name, d.company_name
      FROM cars c
      LEFT JOIN dealers d ON c.dealer_id = d.id
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err: any) {
    console.error("❌ getAllCars:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// 👤 Fetch all dealers
export const getAllDealers = async (req: Request, res: Response) => {
  try {
    const result = await query(`SELECT * FROM dealers ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err: any) {
    console.error("❌ getAllDealers:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// 🏁 Add new car
export const addCar = async (req: Request, res: Response) => {
  try {
    const {
      make,
      model,
      year,
      price,
      mileage,
      location,
      description,
      condition,
      featured,
      status,
      gallery,
      video_url,
      transmission,
      phone,
      dealer_id,
    } = req.body;

    const result = await query(
      `INSERT INTO cars
        (make, model, year, price, mileage, location, description, condition,
         featured, status, gallery, video_url, transmission, phone, dealer_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
       RETURNING *`,
      [
        make,
        model,
        year,
        price,
        mileage,
        location,
        description,
        condition,
        featured,
        status || "active",
        gallery || [],
        video_url,
        transmission,
        phone,
        dealer_id,
      ]
    );

    res.status(201).json({
      message: "✅ Car added successfully",
      car: result.rows[0],
    });
  } catch (err: any) {
    console.error("❌ addCar:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// 🧾 Update existing car
export const updateCar = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const fields = req.body;

    const keys = Object.keys(fields);
    if (keys.length === 0)
      return res.status(400).json({ error: "No fields provided" });

    const setClause = keys.map((k, i) => `${k}=$${i + 1}`).join(", ");
    const values = Object.values(fields);

    const sql = `UPDATE cars SET ${setClause} WHERE id=$${keys.length + 1} RETURNING *`;
    const result = await query(sql, [...values, id]);

    res.json({
      message: "✅ Car updated successfully",
      car: result.rows[0],
    });
  } catch (err: any) {
    console.error("❌ updateCar:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ❌ Delete car
export const deleteCar = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM cars WHERE id=$1", [id]);
    res.json({ message: "✅ Car deleted successfully" });
  } catch (err: any) {
    console.error("❌ deleteCar:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// 🌟 Toggle featured
export const toggleFeatured = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { featured } = req.body;

    const result = await query(
      `UPDATE cars SET featured=$1 WHERE id=$2 RETURNING *`,
      [featured, id]
    );

    res.json({
      message: featured
        ? "✅ Car marked as featured"
        : "✅ Car unfeatured successfully",
      car: result.rows[0],
    });
  } catch (err: any) {
    console.error("❌ toggleFeatured:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Approve / ❌ Reject
export const updateStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await query(
      `UPDATE cars SET status=$1 WHERE id=$2 RETURNING *`,
      [status, id]
    );

    res.json({
      message: `✅ Car ${status === "active" ? "approved" : "rejected"}`,
      car: result.rows[0],
    });
  } catch (err: any) {
    console.error("❌ updateStatus:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// 🖼️ Replace gallery
export const replaceGallery = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { gallery } = req.body;

    const result = await query(
      `UPDATE cars SET gallery=$1 WHERE id=$2 RETURNING *`,
      [gallery, id]
    );

    res.json({
      message: "✅ Gallery updated successfully",
      car: result.rows[0],
    });
  } catch (err: any) {
    console.error("❌ replaceGallery:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// 👤 Add dealer
export const addDealer = async (req: Request, res: Response) => {
  try {
    const { full_name, email, company_name, phone } = req.body;
    const result = await query(
      `INSERT INTO dealers (full_name, email, company_name, phone, created_at)
       VALUES ($1,$2,$3,$4,NOW()) RETURNING *`,
      [full_name, email, company_name, phone]
    );
    res.status(201).json({
      message: "✅ Dealer added successfully",
      dealer: result.rows[0],
    });
  } catch (err: any) {
    console.error("❌ addDealer:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ❌ Delete dealer
export const deleteDealer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await query(`DELETE FROM dealers WHERE id=$1`, [id]);
    res.json({ message: "✅ Dealer deleted successfully" });
  } catch (err: any) {
    console.error("❌ deleteDealer:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/*
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export const uploadToCloudinary = async (req: Request, res: Response) => {
  try {
    const file = req.body.file; // base64 or remote URL
    const result = await cloudinary.uploader.upload(file, {
      folder: "cardirectory",
      resource_type: "auto",
    });
    res.json({ message: "✅ Uploaded successfully", url: result.secure_url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};*/