const express = require("express");

const {
  SignUp,
  Login,
  FetchUserData,
  ForgotPassword, 
  VerifyOTP
} = require("../Controllers/UserController");

const {
  GetCampers,
  GetMealLogs,
  GetSouvenirCount,
  RoleUpdate,
  ScanMeal,
  ScanSouvenir,
  GetSouvenirLogs,
  ResetSession
} = require("../Controllers/AdminController");

const auth = require("../Middleware/AuthMiddleware");

const UserRoute = express.Router();

// ==========================================
// ADMIN GUARD
// ==========================================

const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized."
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  next();
};

// ==========================================
// PUBLIC ROUTES
// ==========================================

UserRoute.post("/signup", SignUp);
UserRoute.post("/login", Login);
UserRoute.post("/forgot-password", ForgotPassword);
UserRoute.post("/verifyOtp", VerifyOTP)
// ==========================================
// USER ROUTES
// ==========================================

UserRoute.get("/me", auth, FetchUserData);

// ==========================================
// ADMIN ROUTES
// ==========================================

UserRoute.get(
  "/admin/getCampers",
  auth,
  adminOnly,
  GetCampers
);

UserRoute.get(
  "/admin/meal-logs",
  auth,
  adminOnly,
  GetMealLogs
);

UserRoute.get(
  "/admin/souvenir-count",
  auth,
  adminOnly,
  GetSouvenirCount
);

UserRoute.put(
  "/admin/campers/:id/role",
  auth,
  adminOnly,
  RoleUpdate
);

UserRoute.post(
  "/admin/meal-scan",
  auth,
  adminOnly,
  ScanMeal
);

UserRoute.post("/admin/souvenir-scan", auth, adminOnly, ScanSouvenir);
UserRoute.get("/admin/souvenir-logs", auth, adminOnly, GetSouvenirLogs);
UserRoute.post("/admin/reset-session", auth, adminOnly, ResetSession);

module.exports = UserRoute;
