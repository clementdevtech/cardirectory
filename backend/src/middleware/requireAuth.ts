import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET as string;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

/* ======================================================
   🔐 REQUIRE AUTH (JWT)
====================================================== */
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1️⃣ Get token from Authorization header
    const bearerToken =
      req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null;

    // 2️⃣ Or from cookie
    const token = bearerToken || req.cookies?.auth_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: No token provided",
      });
    }

    // 3️⃣ Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & {
      id: string;
      email: string;
      role: string;
    };

    if (!decoded?.id || !decoded?.email) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid token",
      });
    }

    // 4️⃣ Attach user to request (global Express type augmentation required)
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Token expired or invalid",
    });
  }
};

/* ======================================================
   🔐 REQUIRE ROLE (OPTIONAL)
====================================================== */
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: Insufficient permissions",
      });
    }

    next();
  };
};

/* ======================================================
   🔐 VERIFY AUTH (LIGHTWEIGHT)
====================================================== */
export const verifyAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded as any;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};
