const mongoose = require("mongoose");

const souvenirSchema = mongoose.Schema({
    camperId:{
        ref:"Users",
        type:mongoose.Schema.Types.ObjectId,
        required:true
    },
    camperName:String,
    collected_at:Date,
    phone:String,
    level:String
}, {
    timestamps:true
})

module.exports = mongoose.model("Souvenirs", souvenirSchema)