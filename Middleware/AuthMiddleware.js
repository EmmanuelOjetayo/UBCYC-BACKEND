const jwt = require("jsonwebtoken");

const Users = require("../Model/User");
const ycampers = require("../Model/YCampers");

require("dotenv").config({
  path: require("path").join(__dirname, "../.env")
});

const auth = async (req, res, next) => {
  try {

  

    if (
      !req.headers.authorization ||
      !req.headers.authorization.startsWith("Bearer ")
    ) {
      console.log("❌ No Bearer token");

      return res.status(401).json({
        success: false,
        message: "Authorization token required"
      });
    }

    const token = req.headers.authorization.split(" ")[1];


    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );


    if (!decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token"
      });
    }

    let user;

    if (decoded.type === "ubcyc") {
      console.log("🔵 Looking in YCampers");
      user = await ycampers.findById(decoded.id).select("-password");
    } else {
      console.log("🟢 Looking in Users");
      user = await Users.findById(decoded.id).select("-password");
      if (!user && !decoded.type) {
        user = await ycampers.findById(decoded.id).select("-password");
      }
    }

    if (!user) {


      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    req.user = user;
    req.user.type = decoded.type;

    console.log("✅ AUTH SUCCESS");


    next();

  } catch (error) {

    console.error("\n❌ AUTH ERROR:");
    console.error("Name:", error.name);
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);

    return res.status(401).json({
      success: false,
      message: "Token invalid or expired"
    });
  }
};

module.exports = auth;