import { Request, Response } from "express";
import { query, pool } from "../db";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { sendZohoMail } from "./emailController";
import { uploadLogoToR2 } from "../utils/cloudflareUpload";
import { console } from "inspector";

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
export const addDealer = async (req, res) => {
  console.log("🚀 addDealer called with body:", req.body);

  try {
    const { full_name, email, company_name, phone, country, logo } = req.body;

    if (!full_name || !email || !company_name || !phone || !country) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // 1️⃣ Check if user already exists
    const existing = await query("SELECT * FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Email already in use." });
    }

    // 2️⃣ Generate and hash password
    const defaultPassword = Math.random().toString(36).slice(-10);
    const hashed = await bcrypt.hash(defaultPassword, 10);

    // 3️⃣ Upload Logo to R2 → stored in company_logo column
    let companyLogoUrl = null;
    if (logo) {
      companyLogoUrl = await uploadLogoToR2(logo); // base64 from frontend
    }

    // 4️⃣ Create User entry
    const userId = uuidv4();
    await query(
      `INSERT INTO users (id, full_name, email, password, role, is_verified, created_at)
       VALUES ($1, $2, $3, $4, 'dealer', true, NOW())`,
      [userId, full_name, email, hashed]
    );

    // 5️⃣ Create Dealer entry (MATCHES YOUR SCHEMA)
    const dealerId = uuidv4();
    const dealerResult = await query(
      `INSERT INTO dealers
       (id, user_id, full_name, company_name, email, phone, country, company_logo, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'verified', NOW())
       RETURNING *`,
      [
        dealerId,
        userId,
        full_name,
        company_name,
        email,
        phone,
        country,
        companyLogoUrl || "default_logo.png"
      ]
    );

    // 6️⃣ Compose email
    const emailBody = `
      Hello ${full_name},<br/><br/>
      Your dealer account has been created.<br/><br/>

      <b>Login Email:</b> ${email}<br/>
      <b>Temporary Password:</b> ${defaultPassword}<br/><br/>

      Please log in and change your password immediately.<br/><br/>
      Thank you,<br/>
      <b>Auto Directory Team</b>
    `;

    // 7️⃣ Send email
    await sendZohoMail(email, "Your Dealer Account Login", emailBody);

    // 8️⃣ Final response
    res.status(201).json({
      message: "Dealer created and login credentials sent.",
      dealer: dealerResult.rows[0],
    });

  } catch (err) {
    console.error("❌ addDealer Error:", err);
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