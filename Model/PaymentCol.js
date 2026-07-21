const mongoose = require("mongoose")

const PaymentCollection = mongoose.Schema({
    camperId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Users",
        required:true
    },
    reference:String,
    date: Date,
    year: Number,
    status:{
        type:String
    },
    amount:Number,

}, { timestamps: true}) // automatically adds createdAt and updatedAt 

module.exports = mongoose.model("PayRecords", PaymentCollection)