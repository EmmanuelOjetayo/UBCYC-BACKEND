const mongoose = require("mongoose");

const UserSchema = mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    role: {
        type: String,
        default: "user"
    },
    name: String,
    phone: String,
    gender: String,
    password: String,
    amount_paid:Number,
    team:String,
    bus_no:String,
    bed_no:String, 

    otp: {
    type: Number,
    default: null,
},

otpExpires: {
    type: Date,
    default: null,
},
})

module.exports = mongoose.model("Users", UserSchema)
