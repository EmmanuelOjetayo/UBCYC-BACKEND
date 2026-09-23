const mongoose = require("mongoose");

const YSouvenirSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            default: "ubcyc"
        },

        camperId: {
            ref: "YCampers",
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        camperName: String,

        collected_at: Date,

        phone: String,

        level: String
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "ysouvenirs",
    YSouvenirSchema
);