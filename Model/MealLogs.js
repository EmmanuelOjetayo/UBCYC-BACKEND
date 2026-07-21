const mongoose = require("mongoose")

const MealLogsCol = mongoose.Schema({
    meal_type: {
        type: String,
        enum: ["Breakfast", "Lunch", "Dinner"],
        default: "Breakfast"
    },
    scanned_at:Date,
    meal_id:String,
    camperId:{
        ref:"Users",
        type:mongoose.Schema.Types.ObjectId
        ,required:true
    },
    day:String,

},{
    timestamps:true
})

module.exports = mongoose.model("MealLogs", MealLogsCol)