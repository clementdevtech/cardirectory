const axios = require("axios");

const CLIENT_ID = "1000.0MA9FATFNYPFZ79SL2K0VJBZ7X2JYB";
const CLIENT_SECRET = "9ff17d3f56d6b7f15d9dbf4c14b22c1262df9050ab";
const REFRESH_TOKEN = "1000.383d6423cba0c48378740f2e6d95ea3a.ef12a5cdfe2dfdade6464d3fbbaa3efb";

async function getAccessToken() {
  try {
    const url = "https://accounts.zoho.com/oauth/v2/token";
    const params = new URLSearchParams({
      refresh_token: REFRESH_TOKEN,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    });

    const response = await axios.post(url, params);
    return response.data.access_token;
  } catch (err) {
    console.error("Failed to refresh token:", err.response?.data || err);
    process.exit(1);
  }
}

async function getAccounts() {
  const accessToken = await getAccessToken();

  try {
    const response = await axios.get(
      "https://www.zohoapis.com/crm/v3/Accounts",
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      }
    );

    console.log("Accounts:", JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error("API Error:", err.response?.data || err);
  }
}

getAccounts();
