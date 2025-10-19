import axios from "axios";

const API_BASE = "https://api.api-ninjas.com/v1";
const headers = {
  "X-Api-Key": process.env.API_NINJAS_KEY!,
};

export const apiNinjas = {
  async validateNationalID(idNumber: string) {
    try {
      const res = await axios.get(`${API_BASE}/nationalid?number=${idNumber}`, { headers });
      return res.data;
    } catch (err: any) {
      console.error("National ID validation failed:", err.message);
      return null;
    }
  },

  async validateKRAPin(kraPin: string) {
    try {
      const res = await axios.get(`${API_BASE}/taxid?number=${kraPin}`, { headers });
      return res.data;
    } catch (err: any) {
      console.error("KRA validation failed:", err.message);
      return null;
    }
  },
};
