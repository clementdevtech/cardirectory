import { Request, Response } from "express";
import { query } from "../db";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { sendZohoMail } from "./emailController";
import { uploadLogoToR2 } from "../utils/cloudflareUpload";

/* ======================================================
   INTERNAL: subscription + grace + override enforcement
====================================================== */
const ensureDealerActive = async (dealerId: string) => {
  const { rows } = await query(
    `SELECT dealer_has_active_access($1) AS allowed`,
    [dealerId]
  );

  return rows[0]?.allowed === true;
};

/* ======================================================
   🚗 Fetch all cars with dealer info (PUBLIC)
====================================================== */
export const getAllCars = async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT c.*, d.full_name AS dealer_name, d.company_name
      FROM cars c
      LEFT JOIN dealers d ON c.dealer_id = d.id
      WHERE d.status = 'verified'
      ORDER BY c.created_at DESC
    `);

    res.json(result.rows);
  } catch (err: any) {
    console.error("❌ getAllCars:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ======================================================
   👤 Fetch all dealers (ADMIN)
====================================================== */
export const getAllDealers = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM dealers ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error("❌ getAllDealers:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ======================================================
   🏁 Add new car (ENFORCED)
====================================================== */
export const addCar = async (req: Request, res: Response) => {
  try {
    const dealerId = req.body.dealer_id;

    if (!(await ensureDealerActive(dealerId))) {
      return res.status(402).json({
        error: "Subscription expired",
        redirect: "/pricing",
      });
    }

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
        status || "pending",
        gallery || [],
        video_url,
        transmission,
        phone,
        dealerId,
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

/* ======================================================
   🧾 Update existing car (ENFORCED)
====================================================== */
export const updateCar = async (req: Request, res: Response) => {
  try {
    const dealerId = req.body.dealer_id;
    if (!(await ensureDealerActive(dealerId))) {
      return res.status(402).json({
        error: "Subscription expired",
        redirect: "/pricing",
      });
    }

    const { id } = req.params;
    const fields = req.body;
    delete fields.dealer_id;

    const keys = Object.keys(fields);
    if (keys.length === 0)
      return res.status(400).json({ error: "No fields provided" });

    const setClause = keys.map((k, i) => `${k}=$${i + 1}`).join(", ");
    const values = Object.values(fields);

    const sql = `
      UPDATE cars SET ${setClause}
      WHERE id=$${keys.length + 1}
      RETURNING *
    `;

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

/* ======================================================
   ❌ Delete car (ENFORCED)
====================================================== */
export const deleteCar = async (req: Request, res: Response) => {
  try {
    const dealerId = req.body.dealer_id;
    if (!(await ensureDealerActive(dealerId))) {
      return res.status(402).json({
        error: "Subscription expired",
        redirect: "/pricing",
      });
    }

    const { id } = req.params;
    await query(`DELETE FROM cars WHERE id=$1`, [id]);

    res.json({ message: "✅ Car deleted successfully" });
  } catch (err: any) {
    console.error("❌ deleteCar:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ======================================================
   🌟 Toggle featured (ENFORCED)
====================================================== */
export const toggleFeatured = async (req: Request, res: Response) => {
  try {
    const dealerId = req.body.dealer_id;
    if (!(await ensureDealerActive(dealerId))) {
      return res.status(402).json({
        error: "Subscription expired",
        redirect: "/pricing",
      });
    }

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

/* ======================================================
   ✅ Approve / ❌ Reject (ADMIN)
====================================================== */
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

/* ======================================================
   🖼️ Replace gallery (ENFORCED)
====================================================== */
export const replaceGallery = async (req: Request, res: Response) => {
  try {
    const dealerId = req.body.dealer_id;
    if (!(await ensureDealerActive(dealerId))) {
      return res.status(402).json({
        error: "Subscription expired",
        redirect: "/pricing",
      });
    }

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

/* ======================================================
   👤 Add dealer (ADMIN)
====================================================== */
export const addDealer = async (req: Request, res: Response) => {
  try {
    const { full_name, email, company_name, phone, country, logo } = req.body;

    if (!full_name || !email || !company_name || !phone || !country) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const existing = await query(
      `SELECT 1 FROM users WHERE email=$1`,
      [email]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Email already in use." });
    }

    const password = Math.random().toString(36).slice(-10);
    const hashed = await bcrypt.hash(password, 10);

    const logoUrl = logo ? await uploadLogoToR2(logo) : "default_logo.png";

    const userId = uuidv4();
    const dealerId = uuidv4();

    await query(
      `INSERT INTO users
       (id, full_name, email, password, role, is_verified, created_at)
       VALUES ($1,$2,$3,$4,'dealer',true,NOW())`,
      [userId, full_name, email, hashed]
    );

    const dealer = await query(
      `INSERT INTO dealers
       (id, user_id, full_name, company_name, email, phone, country, company_logo, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'verified',NOW())
       RETURNING *`,
      [
        dealerId,
        userId,
        full_name,
        company_name,
        email,
        phone,
        country,
        logoUrl,
      ]
    );

    await sendZohoMail(
      email,
      "Your Dealer Account Login",
      `
      Hello ${full_name},<br/><br/>
      <b>Email:</b> ${email}<br/>
      <b>Password:</b> ${password}<br/><br/>
      Please change your password immediately.<br/><br/>
      Auto Directory Team
      `
    );

    res.status(201).json({
      message: "Dealer created and credentials sent",
      dealer: dealer.rows[0],
    });
  } catch (err: any) {
    console.error("❌ addDealer:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ======================================================
   ❌ Delete dealer (ADMIN)
====================================================== */
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

/* ======================================================
   🛡️ Admin override toggle
====================================================== */
export const toggleAdminOverride = async (req: Request, res: Response) => {
  const { dealerId, enabled } = req.body;

  await query(
    `UPDATE dealers SET admin_override=$1 WHERE id=$2`,
    [enabled, dealerId]
  );

  res.json({
    message: enabled
      ? "Dealer override enabled"
      : "Dealer override disabled",
  });
};
