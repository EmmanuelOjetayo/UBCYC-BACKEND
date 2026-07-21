const jwt = require("jsonwebtoken");
const Users = require("../Model/User")
require("dotenv").config({path:require("path").join(__dirname, "../.env")})

const auth = async(req, res, next) =>{
    if(req.headers.authorization && req.headers.authorization.startsWith("Bearer")){
        let token;
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET)
            req.user = await Users.findById(decoded.id).select("-password");
            next();
        } catch (error) {
            res.status(400).json({
                message:"Token found, not authorized"
            })
        }
    }
}


module.exports = auth;