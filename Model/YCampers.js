const mongoose = require("mongoose");

const YCampersSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true
        },

        role: {
            type: String,
            default: "user"
        },

        type: {
            type: String,
            default: "ubcyc"
        },

        name: String,

        phone: String,

        gender: String,

        password: String,

        amount_paid: {
            type: Number,
            default: 0
        },

        team: String,

        bus_no: String,

        bed_no: String,

        resetPasswordToken: {
            type: String,
            default: null
        },

        resetPasswordExpires: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

YCampersSchema.index(
    {
        email: 1,
        type: 1
    },
    {
        unique: true
    }
);

module.exports = mongoose.model("ycampers", YCampersSchema);