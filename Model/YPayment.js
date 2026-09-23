const mongoose = require("mongoose");

const YPaymentSchema = new mongoose.Schema(
    {
        camperId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "YCampers",
            required: true
        },

        type: {
            type: String,
            default: "ubcyc"
        },

        reference: String,

        date: Date,

        year: Number,

        status: {
            type: String
        },

        amount: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "ypayments",
    YPaymentSchema
);