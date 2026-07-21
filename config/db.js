const express = require("express");
const mongoose = require("mongoose")
const dotenv = require("dotenv")
const path = require("path")

dotenv.config({
    path:path.join(__dirname, "../.env")
})

const PORT = process.env.PORT;
const MONGO_URL = process.env.MONGO_URL;
const app = express()

function DB(){
mongoose.connect(MONGO_URL).then(()=>{
    console.log("Database is connected successfully")
    // app.listen(PORT, ()=>{
    //     console.log(`Server is running ${PORT}`)
    // })
}).catch((error)=>console.log(error))
}

module.exports= DB