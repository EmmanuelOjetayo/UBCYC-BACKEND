const express = require('express');
const { verifyPayment } = require('../Controllers/paymentController');
const {  resolveReceiver, transferGiveaway} = require("../Controllers/GiveAway");
const auth = require("../Middleware/AuthMiddleware")
const PaymentRoute = express.Router();

PaymentRoute.post('/verify', verifyPayment);
PaymentRoute.post('/giveaway/resolve', auth, resolveReceiver);
PaymentRoute.post('/giveaway/transfer', auth, transferGiveaway);
module.exports = PaymentRoute;
