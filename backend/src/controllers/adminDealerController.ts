// controllers/adminDealerController.ts
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { query } from "../db"; // ✅ new import style
import { sendMassEmail } from "./emailController"; // ✅ uses your branded mailer

/**
 * Admin creates a new dealer (user + dealer entry)
 * Sends dealer login credentials via email
 */
export const createDealer = async (req, res) => {
  try {
    const { full_name, email, company_name, phone, country } = req.body;

    if (!full_name || !email || !company_name || !phone || !country) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // ✅ Check if user already exists
    const existingUser = await query("SELECT * FROM users WHERE email = $1", [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: "A user with this email already exists." });
    }

    // ✅ Generate random password
    const defaultPassword = Math.random().toString(36).slice(-8); // 8-character password
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // ✅ Create new user
    const userId = uuidv4();
    await query(
      `INSERT INTO users (id, full_name, email, password, role, is_verified, created_at)
       VALUES ($1, $2, $3, $4, 'dealer', true, NOW())`,
      [userId, full_name, email, hashedPassword]
    );

    // ✅ Create dealer entry linked to the user
    const dealerId = uuidv4();
    const dealerResult = await query(
      `INSERT INTO dealers (id, user_id, full_name, company_name, email, phone, country, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'verified', NOW())
       RETURNING *`,
      [dealerId, userId, full_name, company_name, email, phone, country]
    );

    // ✅ Email message content
    const emailMessage = `
      Hello ${full_name},<br/><br/>
      Your dealer account has been successfully created by our admin team.<br/><br/>
      <b>Login Credentials:</b><br/>
      Email: ${email}<br/>
      Password: ${defaultPassword}<br/><br/>
      Please log in and change your password immediately for security reasons.<br/><br/>
      Thank you for joining our dealer network!
    `;

    // ✅ Send email using your styled mailer
    const { success } = await sendMassEmail(
      [email],
      "Your Dealer Account Details",
      emailMessage
    );

    if (!success) {
      console.warn(`⚠️ Dealer account created but email failed to send to ${email}`);
    }

    // ✅ Response
    res.status(201).json({
      message: success
        ? "Dealer account created successfully. Login details have been sent via email."
        : "Dealer account created, but failed to send email.",
      dealer: dealerResult.rows[0],
    });
  } catch (err) {
    console.error("❌ Error creating dealer:", err);
    res.status(500).json({
      message: "Server error creating dealer",
      error: err.message,
    });
  }
};
