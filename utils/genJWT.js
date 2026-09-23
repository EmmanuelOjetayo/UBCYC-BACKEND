const jwt = require("jsonwebtoken");
require("dotenv").config({
  path: require("path").join(__dirname, "../.env")
});

function genJWT(id, type = "gls") {
  return jwt.sign(
    {
      id,
      type
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "30d"
    }
  );
}

module.exports = genJWT;