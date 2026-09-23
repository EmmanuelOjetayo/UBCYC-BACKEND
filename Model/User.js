const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
    {
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

        amount_paid: {
            type: Number,
            default: 0
        },

        status: {
            type: String,
            default: "pending"
        },

        otp: {
            type: Number,
            default: null
        },

        otpExpires: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Users",
    UserSchema
);