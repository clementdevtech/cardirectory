import express from "express";
import {
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
} from "../controllers/adminController";
import { createDealer } from "../controllers/adminDealerController";

const router = express.Router();

// 🚗 Car Routes
router.get("/cars", getAllCars);
router.post("/cars", addCar);
router.put("/cars/:id", updateCar);
router.delete("/cars/:id", deleteCar);
router.patch("/cars/:id/featured", toggleFeatured);
router.patch("/cars/:id/status", updateStatus);
router.patch("/cars/:id/gallery", replaceGallery);


// 👤 Dealer Routes
router.get("/dealers", getAllDealers);
router.post("/dealers", addDealer);
router.delete("/dealers/:id", deleteDealer);

export default router;
