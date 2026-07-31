const { Router } = require("express");
const { requireAuth } = require("../middleware/requireAuth");
const { requireCarOwnership } = require("../middleware/requireCarOwnership");
const { validate } = require("../middleware/validate");

const {
  getDealerCars,
  updateDealerProfile,
  saveCarDraft,
  submitCarListing,
  markCarSold,
} = require("../controllers/dealerController");

const {
  carDraftSchema,
  submitCarSchema,
} = require("../validators/carValidator");

const router = Router();

router.get("/cars", requireAuth, getDealerCars);
router.put("/profile", requireAuth, updateDealerProfile);

/**
 * CREATE or UPDATE DRAFT
 */
router.post(
  "/cars/draft",
  requireAuth,
  validate(carDraftSchema),
  saveCarDraft
);

router.patch(
  "/cars/:id/sold",
  requireAuth,
  requireCarOwnership,
  markCarSold
);

/**
 * FINAL SUBMIT
 */
router.post(
  "/cars/submit/:id",
  requireAuth,
  requireCarOwnership,
  submitCarListing
);

module.exports = router;
