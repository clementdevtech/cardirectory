const { query } = require("../db");

const getDealerId = async (userId) => {
  const { rows } = await query(
    `SELECT id FROM dealers WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return rows[0]?.id || null;
};

const getDealerListingLimit = async (dealerId) => {
  const { rows } = await query(
    `SELECT d.id,
            u.role,
            u.trial_end,
            u.trial_used,
            s.listing_limit,
            s.status AS sub_status,
            (SELECT COUNT(*)::int FROM cars WHERE dealer_id = d.id) AS total_cars
     FROM dealers d
     LEFT JOIN users u ON u.id = d.user_id
     LEFT JOIN LATERAL (
       SELECT listing_limit, status
       FROM dealer_subscriptions
       WHERE dealer_id = d.id
         AND status = 'active'
         AND end_date > NOW()
       ORDER BY end_date DESC
       LIMIT 1
     ) s ON true
     WHERE d.id = $1
     LIMIT 1`,
    [dealerId]
  );

  const row = rows[0];
  const trialActive = !!(row?.trial_end && new Date(row.trial_end) > new Date());
  const freeTrialLimit = 2;
  const paidLimit = Number(row?.listing_limit ?? 0);
  const activeListingLimit = trialActive ? freeTrialLimit : paidLimit || freeTrialLimit;

  return {
    isFreeTrial: !!trialActive,
    activeListingLimit,
    currentCarCount: Number(row?.total_cars ?? 0),
    hasActiveSubscription: !!row?.listing_limit,
  };
};

const getDealerCars = async (req, res) => {
  try {
    const dealerId = await getDealerId(req.user.id);
    if (!dealerId) return res.status(404).json({ message: "Dealer profile not found" });

    const { rows } = await query(
            `SELECT id, make, model, year, price, mileage, condition, transmission,
              location, description, phone, gallery, video_url, featured, status
       FROM cars WHERE dealer_id = $1 ORDER BY created_at DESC`,
      [dealerId]
    );
    return res.json(rows);
  } catch (err) {
    console.error("❌ getDealerCars error:", err.message);
    return res.status(500).json({ message: "Failed to load dealer vehicles" });
  }
};

const updateDealerProfile = async (req, res) => {
  try {
    const dealerId = await getDealerId(req.user.id);
    if (!dealerId) return res.status(404).json({ message: "Dealer profile not found" });

    const allowedFields = [
      "full_name", "company_name", "phone", "country", "city",
      "national_id", "tax_id", "company_logo",
    ];
    const fields = allowedFields.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field));
    if (!fields.length) return res.status(400).json({ message: "No profile fields supplied" });

    const values = fields.map((field) => req.body[field]);
    const assignments = fields.map((field, index) => `${field} = $${index + 1}`);
    values.push(dealerId);

    const { rows } = await query(
      `UPDATE dealers SET ${assignments.join(", ")}, status = 'pending'
       WHERE id = $${values.length} RETURNING *`,
      values
    );
    return res.json(rows[0]);
  } catch (err) {
    console.error("❌ updateDealerProfile error:", err.message);
    return res.status(500).json({ message: "Failed to update dealer profile" });
  }
};

/**
 * CREATE or UPDATE CAR DRAFT
 */
const saveCarDraft = async (req, res) => {
  try {
    const dealerId = await getDealerId(req.user.id);
    if (!dealerId) {
      return res.status(404).json({ message: "Dealer profile not found" });
    }

    const {
      id,
      make,
      model,
      year,
      mileage,
      price,
      condition,
      transmission,
      location,
      description,
      phone,
      gallery,
      video_url,
    } = req.body;

    // UPDATE EXISTING DRAFT
    if (id) {
      const { rows } = await query(
        `
        UPDATE cars
        SET make=$1,
            model=$2,
            year=$3,
            mileage=$4,
            price=$5,
            condition=$6,
            transmission=$7,
            location=$8,
            description=$9,
            phone=$10,
            gallery=$11,
            video_url=$12
        WHERE id=$13 AND dealer_id=$14
        RETURNING *
        `,
        [
          make,
          model,
          year,
          mileage,
          price,
          condition,
          transmission,
          location,
          description,
          phone,
          gallery,
          video_url,
          id,
          dealerId,
        ]
      );

      return res.json(rows[0]);
    }

    const listingLimit = await getDealerListingLimit(dealerId);
    if (listingLimit.isFreeTrial && listingLimit.currentCarCount >= 2) {
      return res.status(403).json({
        message: "Your free trial allows up to 2 listings. Upgrade to add more vehicles.",
      });
    }

    if (!listingLimit.isFreeTrial && listingLimit.hasActiveSubscription && listingLimit.currentCarCount >= listingLimit.activeListingLimit) {
      return res.status(403).json({
        message: "Your listing limit has been reached. Please upgrade your plan.",
      });
    }

    // CREATE NEW DRAFT
    const { rows } = await query(
      `
      INSERT INTO cars
      (
        dealer_id,
        make,
        model,
        year,
        mileage,
        price,
        condition,
        transmission,
        location,
        description,
        phone,
        gallery,
        status
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
      RETURNING *
      `,
      [
        dealerId,
        make,
        model,
        year,
        mileage,
        price,
        condition,
        transmission,
        location,
        description,
        phone,
        gallery,
      ]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error("❌ saveCarDraft error:", err.message);
    return res.status(500).json({ message: "Failed to save draft" });
  }
};

/**
 * FINAL SUBMIT (lock listing for moderation)
 */
const submitCarListing = async (req, res) => {
  try {
    const dealerId = await getDealerId(req.user.id);
    if (!dealerId) {
      return res.status(404).json({ message: "Dealer profile not found" });
    }
    const { id } = req.params;

    await query(
      `
      UPDATE cars
      SET status='pending'
      WHERE id=$1 AND dealer_id=$2
      `,
      [id, dealerId]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ submitCarListing error:", err.message);
    return res.status(500).json({ message: "Failed to submit listing" });
  }
};

const markCarSold = async (req, res) => {
  try {
    const dealerId = await getDealerId(req.user.id);
    if (!dealerId) return res.status(404).json({ message: "Dealer profile not found" });

    const { rows } = await query(
      `UPDATE cars SET status = 'sold'
       WHERE id = $1 AND dealer_id = $2
       RETURNING id, status`,
      [req.params.id, dealerId]
    );

    if (!rows.length) return res.status(404).json({ message: "Vehicle not found" });
    return res.json({ success: true, car: rows[0] });
  } catch (err) {
    console.error("❌ markCarSold error:", err.message);
    return res.status(500).json({ message: "Failed to mark vehicle as sold" });
  }
};

module.exports = {
  getDealerCars,
  updateDealerProfile,
  saveCarDraft,
  submitCarListing,
  markCarSold,
};
