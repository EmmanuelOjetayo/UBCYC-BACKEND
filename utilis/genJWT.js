const jwt = require("jsonwebtoken")
require("dotenv").config({path:require("path").join(__dirname, "../.env")})
function genJWT(id){
    return jwt.sign(
        {id},
        process.env.JWT_SECRET,
        {expiresIn:"1h"}
    )
}

module.exports = genJWT;