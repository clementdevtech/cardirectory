import axios from "axios";
import qs from "qs";
import dotenv from "dotenv";
dotenv.config();

const MPESA_ENV = process.env.MPESA_ENV ?? "sandbox";
const base = MPESA_ENV === "live"
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke";

const consumerKey = process.env.MPESA_CONSUMER_KEY!;
const consumerSecret = process.env.MPESA_CONSUMER_SECRET!;
const shortcode = process.env.MPESA_SHORTCODE!;
const passkey = process.env.MPESA_PASSKEY!;
const callbackURL = process.env.MPESA_CALLBACK_URL!;

if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackURL) {
  console.warn("MPESA credentials missing — STK Push will fail until provided.");
}

export async function getAccessToken(): Promise<string> {
  const url = `${base}/oauth/v1/generate?grant_type=client_credentials`;
  const token = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const res = await axios.get(url, { headers: { Authorization: `Basic ${token}` }});
  return res.data.access_token;
}

export async function initiateStkPush(phone: string, amount: number, accountRef = "AUTO_APP", desc = "Payment") {
  const token = await getAccessToken();
  const timestamp = new Date().toISOString().replace(/[-:TZ\.]/g, '').slice(0,14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
  const url = `${base}/mpesa/stkpush/v1/processrequest`;

  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.round(amount),
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: callbackURL,
    AccountReference: accountRef,
    TransactionDesc: desc
  };

  const res = await axios.post(url, body, { headers: { Authorization: `Bearer ${token}` }});
  return res.data;
}
