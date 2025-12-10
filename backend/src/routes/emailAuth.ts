import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

router.get("/callback", async (req, res) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send("Missing code");

  try {
    const params = new URLSearchParams({
      code,
      client_id: process.env.ZOHO_CLIENT_ID!,
      client_secret: process.env.ZOHO_CLIENT_SECRET!,
      redirect_uri: "https://cardirectory.onrender.com/oauth/callback",
      grant_type: "authorization_code",
    });

    const tokenRes = await fetch(`${process.env.ZOHO_ACCOUNTS_HOST}/oauth/v2/token`, {
      method: "POST",
      body: params,
    });

    const data = await tokenRes.json();

    console.log("ZOHO TOKEN RESPONSE:", data);
    res.send(
      `Refresh token: <pre>${data.refresh_token}</pre><br/>Access token: <pre>${data.access_token}</pre>`
    );
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to exchange code for token");
  }
});

export default router;
