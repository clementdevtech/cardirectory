const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { query } = require("../db");
const { sendZohoMail } = require("./emailController");
const { uploadLogoToR2 } = require("../utils/cloudflareUpload");

/* ======================================================
   INTERNAL: subscription + grace + override enforcement
====================================================== */
const ensureDealerActive = async (dealerId) => {
  try {
    // 1️⃣ Check for admin override
    const dealerResult = await query(
      `SELECT admin_override FROM dealers WHERE id = $1`,
      [dealerId]
    );

    if (dealerResult.rows[0]?.admin_override) {
      return true; // Admin override bypasses subscription check
    }

    // 2️⃣ Check for active subscription
    // Use UTC for now() to avoid timezone mismatches
    const subscriptionResult = await query(
      `
      SELECT *
      FROM subscriptions
      WHERE dealer_id = $1
        AND now() AT TIME ZONE 'UTC' BETWEEN start_date AT TIME ZONE 'UTC' AND end_date AT TIME ZONE 'UTC'
        AND (
          listings_allowed IS NULL
          OR listings_used < listings_allowed
        )
      ORDER BY end_date DESC
      LIMIT 1
      `,
      [dealerId]
    );

    if (!subscriptionResult.rows.length) {
      // No active subscription found
      return false;
    }

    // 3️⃣ Optional: you could also increment listings_used here if adding a car
        const subscription = subscriptionResult.rows[0];
       await query(
       `UPDATE subscriptions SET listings_used = listings_used + 1 WHERE id=$1`,
       [subscription.id]
    );

    return true;
  } catch (err) {
    console.error("ensureDealerActive error:", err);
    return false; // Fail safe: treat as inactive if error occurs
  }
};



/* ======================================================
    Fetch all cars with dealer info (PUBLIC)
====================================================== */
const getAllCars = async (req, res) => {
  try {
    const result = await query(`
      SELECT c.*, d.full_name AS dealer_name, d.company_name
      FROM cars c
      LEFT JOIN dealers d ON c.dealer_id = d.id
      WHERE d.status = 'verified'
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ getAllCars:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ======================================================
   👤 Fetch all dealers (ADMIN)
====================================================== */
const getAllDealers = async (req, res) => {
  try {
    const result = await query(`SELECT * FROM dealers ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ getAllDealers:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ======================================================
   🏁 Add new car (ENFORCED)
====================================================== */
const addCar = async (req, res) => {
  try {
    const dealerId = req.body.dealer_id;

    console.log("Dealer ID being checked:", dealerId);


    const isActive = await ensureDealerActive(dealerId);

    if (!isActive) {
      return res.status(402).json({
        success: false,
        error: "Subscription expired or inactive",
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
  } catch (err) {
    console.error("❌ addCar:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ======================================================
   🧾 Update existing car (ENFORCED)
====================================================== */
const updateCar = async (req, res) => {
  try {
    const dealerId = req.body.dealer_id;

    const isActive = await ensureDealerActive(dealerId);

    if (!isActive) {
      return res.status(402).json({
        success: false,
        error: "Subscription expired or inactive",
        redirect: "/pricing",
      });
    }

    const id = req.params.id;
    const fields = { ...req.body };
    delete fields.dealer_id;

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
  } catch (err) {
    console.error("❌ updateCar:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ======================================================
   ❌ Delete car (ENFORCED)
====================================================== */
const deleteCar = async (req, res) => {
  try {
    const dealerId = req.body.dealer_id;
    
    const isActive = await ensureDealerActive(dealerId);

    if (!isActive) {
      return res.status(402).json({
        success: false,
        error: "Subscription expired or inactive",
        redirect: "/pricing",
      });
    }

    const id = req.params.id;
    await query(`DELETE FROM cars WHERE id=$1`, [id]);

    res.json({ message: "✅ Car deleted successfully" });
  } catch (err) {
    console.error("❌ deleteCar:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ======================================================
   🌟 Toggle featured (ENFORCED)
====================================================== */
const toggleFeatured = async (req, res) => {
  try {
    const dealerId = req.body.dealer_id;
    
    const isActive = await ensureDealerActive(dealerId);

    if (!isActive) {
      return res.status(402).json({
        success: false,
        error: "Subscription expired or inactive",
        redirect: "/pricing",
      });
    }

    const id = req.params.id;
    const featured = req.body.featured;

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
  } catch (err) {
    console.error("❌ toggleFeatured:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ======================================================
   ✅ Approve / ❌ Reject (ADMIN)
====================================================== */
const updateStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const status = req.body.status;

    const result = await query(
      `UPDATE cars SET status=$1 WHERE id=$2 RETURNING *`,
      [status, id]
    );

    res.json({
      message: `✅ Car ${status === "active" ? "approved" : "rejected"}`,
      car: result.rows[0],
    });
  } catch (err) {
    console.error("❌ updateStatus:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ======================================================
   🖼️ Replace gallery (ENFORCED)
====================================================== */
const replaceGallery = async (req, res) => {
  try {
    const dealerId = req.body.dealer_id;
    if (!(await ensureDealerActive(dealerId))) {
      return res.status(402).json({
        error: "Subscription expired",
        redirect: "/pricing",
      });
    }

    const id = req.params.id;
    const gallery = req.body.gallery;

    const result = await query(
      `UPDATE cars SET gallery=$1 WHERE id=$2 RETURNING *`,
      [gallery, id]
    );

    res.json({
      message: "✅ Gallery updated successfully",
      car: result.rows[0],
    });
  } catch (err) {
    console.error("❌ replaceGallery:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ======================================================
   👤 Add dealer (ADMIN)
====================================================== */
const addDealer = async (req, res) => {
  try {
    const { full_name, email, company_name, phone, country, logo } = req.body;

    if (!full_name || !email || !company_name || !phone || !country) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const existing = await query(`SELECT 1 FROM users WHERE email=$1`, [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Email already in use." });
    }

    const password = Math.random().toString(36).slice(-10);
    const hashed = await bcrypt.hash(password, 10);
    const logoUrl = logo ? await uploadLogoToR2(logo) : "default_logo.png";

    const userId = uuidv4();
    const dealerId = uuidv4();

    await query(
      `INSERT INTO users (id, full_name, email, password, role, is_verified, created_at)
       VALUES ($1,$2,$3,$4,'dealer',true,NOW())`,
      [userId, full_name, email, hashed]
    );

    const dealer = await query(
      `INSERT INTO dealers
       (id, user_id, full_name, company_name, email, phone, country, company_logo, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'verified',NOW()) RETURNING *`,
      [dealerId, userId, full_name, company_name, email, phone, country, logoUrl]
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
  } catch (err) {
    console.error("❌ addDealer:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ======================================================
   ❌ Delete dealer (ADMIN)
====================================================== */
const deleteDealer = async (req, res) => {
  try {
    const id = req.params.id;
    await query(`DELETE FROM dealers WHERE id=$1`, [id]);
    res.json({ message: "✅ Dealer deleted successfully" });
  } catch (err) {
    console.error("❌ deleteDealer:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ======================================================
   🛡️ Admin override toggle
====================================================== */
const toggleAdminOverride = async (req, res) => {
  const dealerId = req.body.dealerId;
  const enabled = req.body.enabled;

  await query(`UPDATE dealers SET admin_override=$1 WHERE id=$2`, [
    enabled,
    dealerId,
  ]);

  res.json({
    message: enabled ? "Dealer override enabled" : "Dealer override disabled",
  });
};

module.exports = {
  getAllCars,
  getAllDealers,
  addCar,
  updateCar,
  deleteCar,
  toggleFeatured,
  updateStatus,
  replaceGallery,
  addDealer,
  deleteDealer,
  toggleAdminOverride,
};
