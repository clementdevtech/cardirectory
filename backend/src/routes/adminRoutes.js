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
} = require("../controllers/adminController");

const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

//  Car Routes
router.get("/cars", getAllCars);
router.post("/cars", requireAuth, addCar);
router.put("/cars/:id", requireAuth, updateCar);
router.delete("/cars/:id", requireAuth, deleteCar);
router.patch("/cars/:id/featured", requireAuth, toggleFeatured);
router.patch("/cars/:id/status", requireAuth, updateStatus);
router.patch("/cars/:id/gallery", requireAuth, replaceGallery);

// 👤 Dealer Routes
router.get("/dealers", requireAuth, getAllDealers);
router.post("/dealers", requireAuth, addDealer);
router.delete("/dealers/:id", requireAuth, deleteDealer);

module.exports = router;
