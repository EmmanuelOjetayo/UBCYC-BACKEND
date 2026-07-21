const express = require("express");
const DB_Connect = require("../config/db.js");
const PORT = process.env.PORT || 5000;
const cors = require("cors")
const app = express();

const errorMiddleware = require("../Middleware/ErrorMiddleware.js")
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({extended:false}))

const userRoute = require("../Routes/UserRoute.js")
const PaymentRoute = require("../Routes/PaymentRoute.js")

app.use("/api/user", userRoute);
app.use("/api/payment", PaymentRoute)

app.use(errorMiddleware);

DB_Connect();

app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`)
})