import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireLandlord(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "landlord") {
      return res.status(403).json({ error: "Landlord access required" });
    }
    next();
  });
}

export function requireTenant(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "tenant") {
      return res.status(403).json({ error: "Tenant access required" });
    }
    next();
  });
}
