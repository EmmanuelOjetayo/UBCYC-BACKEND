const express = require("express")
const {SignUp, Login, FetchUserData } = require("../Controllers/UserController");
const {GetCampers, GetMealLogs, GetSouvenirCount, RoleUpdate, ScanMeal} = require("../Controllers/AdminController")
const auth = require("../Middleware/AuthMiddleware")
const UserRoute = express.Router();

UserRoute.post("/signup", SignUp);
UserRoute.post("/login", Login);
UserRoute.get("/me", auth, FetchUserData),
UserRoute.get("/admin/getCampers", auth, GetCampers);
UserRoute.get("/admin/meal-logs", auth, GetMealLogs)
UserRoute.get("/admin/souvenir-count", auth, GetSouvenirCount )
UserRoute.put(
  "/admin/campers/:id/role",
  (req, res, next) => {
    console.log("✅ Role route hit");
    next();
  },
  auth,
  RoleUpdate
);
UserRoute.post("/admin/meal-scan", auth, ScanMeal);
module.exports = UserRoute