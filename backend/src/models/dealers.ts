import pool from "../db";
import { apiNinjas } from "../utils/validators";

export async function validateDealer(id: string, kraPin: string) {
  const idValid = await apiNinjas.validateNationalID(id);
  const kraValid = await apiNinjas.validateKRAPin(kraPin);

  if (!idValid || !kraValid) return { success: false, message: "Validation failed" };

  return { success: true, data: { id: idValid, kra: kraValid } };
}