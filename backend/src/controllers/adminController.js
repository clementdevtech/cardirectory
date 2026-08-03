const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { query } = require("../db");
const { sendEmail, sendMassEmail } = require("./emailController");
const { uploadLogoToR2 } = require("../utils/cloudflareUpload");

const getSalesDashboard = async (req, res) => {
  try {
    const salespersonId = req.params.userId || req.user?.id;

    const dealerCountResult = await query(
      `SELECT COUNT(*)::int AS count FROM dealers WHERE referred_by = $1`,
      [salespersonId]
    );

    const activeDealerCountResult = await query(
      `SELECT COUNT(*)::int AS count FROM dealers WHERE referred_by = $1 AND status = 'verified'`,
      [salespersonId]
    );

    const commissionResult = await query(
      `SELECT COALESCE(SUM(commission_amount), 0)::numeric AS total FROM sales_commissions WHERE salesperson_id = $1 AND status = 'paid'`,
      [salespersonId]
    );

    const commissionsResult = await query(
      `SELECT * FROM sales_commissions WHERE salesperson_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [salespersonId]
    );

    const dealersResult = await query(
      `SELECT id, full_name, company_name, email, phone, status, created_at, referred_by
       FROM dealers
       WHERE referred_by = $1
       ORDER BY created_at DESC LIMIT 20`,
      [salespersonId]
    );

    const dealerCarsResult = await query(
      `SELECT c.id, c.make, c.model, c.year, c.status, c.created_at, d.full_name AS dealer_name, d.company_name
       FROM cars c
       JOIN dealers d ON d.id = c.dealer_id
       WHERE d.referred_by = $1
       ORDER BY c.created_at DESC LIMIT 20`,
      [salespersonId]
    );

    res.json({
      dealersBrought: dealerCountResult.rows[0]?.count || 0,
      activeDealers: activeDealerCountResult.rows[0]?.count || 0,
      commissionEarned: Number(commissionResult.rows[0]?.total || 0),
      commissions: commissionsResult.rows,
      dealers: dealersResult.rows,
      dealerCars: dealerCarsResult.rows,
    });
  } catch (err) {
    console.error("❌ getSalesDashboard error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const getAdminUsers = async (req, res) => {
  try {
    const result = await query(`
      SELECT id, full_name, email, role, is_verified, commission_rate, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ getAdminUsers error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const updateUserRoleAndCommission = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, commission_rate } = req.body;

    if (!id) return res.status(400).json({ error: "User id is required" });

    const updates = [];
    const values = [];

    if (role) {
      updates.push(`role = $${values.length + 1}`);
      values.push(role);
    }

    if (typeof commission_rate === "number") {
      updates.push(`commission_rate = $${values.length + 1}`);
      values.push(commission_rate);
    }

    if (!updates.length) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    values.push(id);
    const result = await query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING id, full_name, email, role, commission_rate`,
      values
    );

    if (role) {
      await query(
        `INSERT INTO user_roles (user_id, role)
         VALUES ($1, $2)
         ON CONFLICT (user_id)
         DO UPDATE SET role = EXCLUDED.role`,
        [id, role]
      );

      if (role === "dealer") {
        const userResult = await query(
          `SELECT full_name, email, phone FROM users WHERE id = $1`,
          [id]
        );

        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          await query(
            `INSERT INTO dealers
              (id, user_id, full_name, company_name, email, phone, status, created_at)
             VALUES ($1, $2, $3, $3, $4, $5, 'pending', NOW())
             ON CONFLICT (user_id) DO NOTHING`,
            [uuidv4(), id, user.full_name, user.email, user.phone || null]
          );
        }
      }
    }

    const refreshedResult = await query(
      `SELECT id, full_name, email, role, commission_rate FROM users WHERE id = $1`,
      [id]
    );

    res.json({ message: "User updated", user: refreshedResult.rows[0] });
  } catch (err) {
    console.error("❌ updateUserRoleAndCommission error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const recordSalesCommission = async (req, res) => {
  try {
    const { salespersonId, dealerId, paymentId, packageName, packageAmount, commissionRate, status = "pending" } = req.body;

    if (!salespersonId || !dealerId || !paymentId) {
      return res.status(400).json({ error: "salespersonId, dealerId and paymentId are required" });
    }

    const rate = Number(commissionRate || 15);
    const amount = Number(packageAmount || 0) * (rate / 100);

    const result = await query(
      `INSERT INTO sales_commissions (salesperson_id, dealer_id, payment_id, package_name, package_amount, commission_rate, commission_amount, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [salespersonId, dealerId, paymentId, packageName || "Package", Number(packageAmount || 0), rate, amount, status]
    );

    await query(
      `UPDATE dealers SET referred_by = $1, sales_commission_rate = $2 WHERE id = $3`,
      [salespersonId, rate, dealerId]
    );

    res.status(201).json({ commission: result.rows[0] });
  } catch (err) {
    console.error("❌ recordSalesCommission error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ======================================================
   INTERNAL: subscription + grace + override enforcement
====================================================== */
const ensureDealerActive = async (userId) => {
  try {
    // 1️⃣ Get dealer by user_id
    const dealerResult = await query(
      `SELECT id, admin_override FROM dealers WHERE user_id = $1`,
      [userId]
    );

    if (!dealerResult.rows.length) {
      console.warn("No dealer found for user:", userId);
      return false;
    }

    const dealer = dealerResult.rows[0];

    // 2️⃣ Admin override bypass
    if (dealer.admin_override) {
      return true;
    }

    const dealerId = dealer.id;

    // 3️⃣ Check for active subscription
    // Use timezone-safe UTC comparison
    const subscriptionResult = await query(
      `
      SELECT *
      FROM subscriptions
      WHERE dealer_id = $1
        AND start_date <= now() AT TIME ZONE 'UTC'
        AND end_date >= now() AT TIME ZONE 'UTC'
        AND (listings_allowed IS NULL OR listings_used < listings_allowed)
      ORDER BY end_date DESC
      LIMIT 1
      `,
      [dealerId]
    );

    if (!subscriptionResult.rows.length) {
      // No active subscription
      return false;
    }

    // 4️⃣ Increment listings_used
    const subscription = subscriptionResult.rows[0];
    await query(
      `UPDATE subscriptions SET listings_used = listings_used + 1 WHERE id = $1`,
      [subscription.id]
    );

    return true;
  } catch (err) {
    console.error("ensureDealerActive error:", err);
    return false; // Fail-safe
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
    if (req.user?.role === "salesperson") {
      const result = await query(`SELECT * FROM dealers WHERE referred_by = $1 ORDER BY created_at DESC`, [req.user.id]);
      return res.json(result.rows);
    }

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
    const userId = req.user.id;
    const role = req.user?.role;
    const isAdmin = role === "admin";
    const isSalesperson = role === "salesperson";

    let dealerId = null;

    if (req.body.dealer_id) {
      const dealerRes = await query(`SELECT id, referred_by FROM dealers WHERE id = $1`, [req.body.dealer_id]);
      if (!dealerRes.rows.length) {
        return res.status(404).json({ error: "Dealer not found" });
      }

      const dealer = dealerRes.rows[0];
      if (isSalesperson && dealer.referred_by !== userId) {
        return res.status(403).json({ error: "You can only add cars for dealers you added" });
      }

      dealerId = dealer.id;
    } else if (isSalesperson) {
      return res.status(400).json({ error: "Please select a dealer for this vehicle" });
    } else {
      const dealerRes = await query(`SELECT id FROM dealers WHERE user_id = $1`, [userId]);
      if (!dealerRes.rows.length) {
        return res.status(404).json({ error: "Dealer not found for this user" });
      }
      dealerId = dealerRes.rows[0].id;
    }

    if (!isAdmin) {
      const isActive = await ensureDealerActive(userId);
      if (!isActive) {
        return res.status(402).json({
          success: false,
          error: "Subscription expired or inactive",
          redirect: "/pricing",
        });
      }
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
        dealerId, // ✅ must be dealers.id
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
    const dealerId = req.user.id;

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
    const dealerId = req.user.id;
    
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
   
    const id = req.params.id;
    const featured = req.body.featured;

    const result = await query(
      `UPDATE cars SET featured=$1 WHERE id=$2 RETURNING *`,
      [featured, id]
    );

    if (featured && result.rows[0]) {
      try {
        const usersResult = await query(
          `SELECT email FROM users WHERE email IS NOT NULL AND email <> ''`
        );
        const recipients = usersResult.rows.map((user) => user.email);
        if (recipients.length) {
          const car = result.rows[0];
          await sendMassEmail(
            recipients,
            "New Featured Car on CarDirectory",
            `A new vehicle has been featured on CarDirectory:<br/><br/>
             <b>${car.make || "Vehicle"} ${car.model || ""}</b><br/>
             ${car.location ? `Location: ${car.location}<br/>` : ""}
             ${car.price ? `Price: KES ${Number(car.price).toLocaleString()}<br/>` : ""}
             <br/><a href="${process.env.FRONTEND_URL}/cars/${car.id}">View vehicle</a>`
          );
        }
      } catch (emailError) {
        console.error("Featured car notification failed:", emailError.message);
      }
    }

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
    const dealerId = req.user.id;
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
    const creatorRole = req.user?.role;
    const referredBy = creatorRole === "salesperson" ? req.user.id : null;

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
       (id, user_id, full_name, company_name, email, phone, country, company_logo, status, referred_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'verified',$9,NOW()) RETURNING *`,
      [dealerId, userId, full_name, company_name, email, phone, country, logoUrl, referredBy]
    );

    await sendEmail(
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
   ✅ Verify dealer (ADMIN)
====================================================== */
const verifyDealer = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await query(
      `UPDATE dealers SET verified = true, status = 'verified', verified_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Dealer not found" });
    }

    res.json({ message: "✅ Dealer verified successfully", dealer: result.rows[0] });
  } catch (err) {
    console.error("❌ verifyDealer:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ======================================================
   🛡️ Admin override toggle
====================================================== */
const extendDealerAccess = async (req, res) => {
  try {
    const dealerId = req.params.id;
    const { extraDays, extraListings } = req.body;

    if (!dealerId) {
      return res.status(400).json({ error: "Dealer id is required" });
    }

    if ((typeof extraDays !== "number" || extraDays < 0) && (typeof extraListings !== "number" || extraListings < 0)) {
      return res.status(400).json({ error: "extraDays or extraListings must be provided" });
    }

    const dealerResult = await query(`SELECT id, user_id FROM dealers WHERE id = $1`, [dealerId]);
    if (!dealerResult.rows.length) {
      return res.status(404).json({ error: "Dealer not found" });
    }

    const dealer = dealerResult.rows[0];
    const now = new Date();
    const existingSub = await query(
      `SELECT * FROM subscriptions WHERE dealer_id = $1 ORDER BY end_date DESC LIMIT 1`,
      [dealerId]
    );

    let endDate = now;
    let listingsAllowed = extraListings ?? 0;
    let listingsUsed = 0;
    let result;

    if (existingSub.rows.length > 0) {
      const subscription = existingSub.rows[0];
      const currentEndDate = subscription.end_date ? new Date(subscription.end_date) : now;
      endDate = currentEndDate > now ? currentEndDate : now;
      listingsAllowed = (subscription.listings_allowed ?? 0) + (extraListings ?? 0);
      listingsUsed = subscription.listings_used ?? 0;

      if (typeof extraDays === "number" && extraDays > 0) {
        endDate.setDate(endDate.getDate() + extraDays);
      }

      result = await query(
        `UPDATE subscriptions
         SET end_date = $1,
             listings_allowed = $2,
             active = true
         WHERE id = $3
         RETURNING *`,
        [endDate.toISOString(), listingsAllowed, subscription.id]
      );
    } else {
      if (typeof extraDays === "number" && extraDays > 0) {
        endDate.setDate(endDate.getDate() + extraDays);
      }

      if (endDate <= now) {
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() + 7);
      }

      result = await query(
        `INSERT INTO subscriptions
         (dealer_id, plan_name, listings_allowed, listings_used, start_date, end_date, active)
         VALUES ($1, 'admin-extension', $2, $3, $4, $5, true)
         RETURNING *`,
        [dealerId, listingsAllowed, listingsUsed, now.toISOString(), endDate.toISOString()]
      );
    }

    if (typeof extraDays === "number" && extraDays > 0) {
      const userResult = await query(`SELECT trial_end FROM users WHERE id = $1`, [dealer.user_id]);
      if (userResult.rows.length > 0) {
        const trialRow = userResult.rows[0];
        const currentTrialEnd = trialRow.trial_end ? new Date(trialRow.trial_end) : now;
        const newTrialEnd = new Date(currentTrialEnd > now ? currentTrialEnd : now);
        newTrialEnd.setDate(newTrialEnd.getDate() + extraDays);

        await query(
          `UPDATE users SET trial_end = $1, trial_used = true WHERE id = $2`,
          [newTrialEnd.toISOString(), dealer.user_id]
        );
      }
    }

    res.json({
      message: "✅ Dealer access extended successfully",
      subscription: result.rows[0],
    });
  } catch (err) {
    console.error("❌ extendDealerAccess:", err.message);
    res.status(500).json({ error: err.message });
  }
};

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
  verifyDealer,
  extendDealerAccess,
  toggleAdminOverride,
  getSalesDashboard,
  getAdminUsers,
  updateUserRoleAndCommission,
  recordSalesCommission,
};
