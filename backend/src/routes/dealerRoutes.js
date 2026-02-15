const { Router } = require("express");
const { requireAuth } = require("../middleware/requireAuth");
const { requireCarOwnership } = require("../middleware/requireCarOwnership");
const { validate } = require("../middleware/validate");

const {
  saveCarDraft,
  submitCarListing,
} = require("../controllers/dealerController");

const {
  carDraftSchema,
  submitCarSchema,
} = require("../validators/carValidator");

const router = Router();

/**
 * CREATE or UPDATE DRAFT
 */
router.post(
  "/cars/draft",
  requireAuth,
  validate(carDraftSchema),
  saveCarDraft
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
