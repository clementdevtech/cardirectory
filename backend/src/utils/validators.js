const axios = require("axios");

const API_BASE = "https://api.api-ninjas.com/v1";
const headers = {
  "X-Api-Key": process.env.API_NINJAS_KEY,
};

const apiNinjas = {
  async validateNationalID(idNumber) {
    try {
      const res = await axios.get(`${API_BASE}/nationalid?number=${idNumber}`, { headers });
      return res.data;
    } catch (err) {
      console.error("National ID validation failed:", err.message);
      return null;
    }
  },

  async validateKRAPin(kraPin) {
    try {
      const res = await axios.get(`${API_BASE}/taxid?number=${kraPin}`, { headers });
      return res.data;
    } catch (err) {
      console.error("KRA validation failed:", err.message);
      return null;
    }
  },
};

module.exports = { apiNinjas };
