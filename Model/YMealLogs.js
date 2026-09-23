const mongoose = require("mongoose");

const YMealLogsSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            default: "ubcyc"
        },

        meal_type: {
            type: String,
            enum: [
                "Breakfast",
                "Lunch",
                "Dinner"
            ],
            default: "Breakfast"
        },

        scanned_at: Date,

        meal_id: String,

        camperId: {
            ref: "YCampers",
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        day: String
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "ymeallogs",
    YMealLogsSchema
);