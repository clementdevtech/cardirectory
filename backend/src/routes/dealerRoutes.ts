import { Router } from "express";
import { requireCarOwnership } from "../middleware/requireCarOwnership";
import { validate } from "../middleware/validate";

import {
  saveCarDraft,
  submitCarListing,
} from "../controllers/dealerController";

import {
  carDraftSchema,
  submitCarSchema,
} from "../validators/carValidator";

const router = Router();

/**
 * CREATE or UPDATE DRAFT
 */
router.post(
  "/cars/draft",
  validate(carDraftSchema),
  saveCarDraft
);

/**
 * FINAL SUBMIT
 */
router.post(
  "/cars/submit/:id",
  requireCarOwnership,
  submitCarListing
);

export default router;
