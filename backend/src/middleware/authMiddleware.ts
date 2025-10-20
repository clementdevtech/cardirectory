import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is not defined in environment variables.");

interface AuthRequest extends Request {
  user?: string | JwtPayload;
}

export const verifyAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token =
      req.cookies?.auth_token ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const decoded = jwt.verify(token, JWT_SECRET); // ✅ JWT_SECRET is now guaranteed to exist
    req.user = decoded;
    next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown authentication error";
    console.error("Auth validation failed:", message);

    return res
      .status(401)
      .json({ success: false, error: "Session expired. Please log in again." });
  }
};
