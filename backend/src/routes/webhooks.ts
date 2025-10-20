import express from "express";
import { handlePesaPalWebhook } from "../controllers/pesapalWebhook";


const router = express.Router();

router.post("/pesapal", handlePesaPalWebhook);

export default router;
