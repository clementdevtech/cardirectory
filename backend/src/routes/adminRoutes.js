const express = require("express");
const {
  getAllCars,
  addCar,
  updateCar,
  deleteCar,
  toggleFeatured,
  updateStatus,
  replaceGallery,
  getAllDealers,
  addDealer,
  deleteDealer,
  getSalesDashboard,
  getAdminUsers,
  updateUserRoleAndCommission,
  recordSalesCommission,
} = require("../controllers/adminController");
const { createEmailCampaign } = require("../controllers/emailController");

const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

//  Car Routes
router.get("/cars", getAllCars);
router.post("/cars", requireAuth, addCar);
router.put("/cars/:id", requireAuth, updateCar);
router.delete("/cars/:id", requireAuth, deleteCar);
router.patch("/cars/:id/featured", toggleFeatured);
router.patch("/cars/:id/status", updateStatus);
router.patch("/cars/:id/gallery", requireAuth, replaceGallery);

// 👤 Dealer Routes
router.get("/dealers", getAllDealers);
router.post("/dealers", addDealer);
router.delete("/dealers/:id", deleteDealer);

// 📊 Sales Routes
router.get("/sales-dashboard/:userId", requireAuth, getSalesDashboard);
router.get("/sales-dashboard", requireAuth, getSalesDashboard);
router.get("/users", requireAuth, getAdminUsers);
router.patch("/users/:id", requireAuth, updateUserRoleAndCommission);
router.post("/sales-commission", requireAuth, recordSalesCommission);
router.post("/email-campaign", requireAuth, createEmailCampaign);

module.exports = router;
