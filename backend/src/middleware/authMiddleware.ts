import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is not defined in environment variables.");

export interface AuthRequest extends Request {
  user?: string | JwtPayload;
}

// ✅ Use type narrowing to safely access headers and cookies
export const verifyAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader =
      typeof req.headers?.authorization === "string"
        ? req.headers.authorization
        : "";

    const token =
      (req as any)?.cookies?.auth_token ||
      (authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null);

    if (!token) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown authentication error";
    console.error("Auth validation failed:", message);

    res
      .status(401)
      .json({ success: false, error: "Session expired. Please log in again." });
  }
};
