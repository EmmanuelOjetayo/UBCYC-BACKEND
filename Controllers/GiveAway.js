const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
  path: path.join(__dirname, "../.env")
});

const User = require('../Model/User');
const Payment = require('../Model/PaymentCol');

const TARGET_FEE = Number(process.env.TARGET_FEE) || 5000;

// --- RESOLVE RECEIVER NAME ---
exports.resolveReceiver = async (req, res, next) => {
  try {
    const { receiverId, senderId } = req.body;

    // Prevent self-resolve
    if (senderId && senderId === receiverId) {
      const err = new Error('Illegal Operation: You cannot giveaway funds to yourself.');
      err.statusCode = 400;
      throw err;
    }

    const user = await User.findById(receiverId);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    res.status(200).json({ success: true, name: user.name });
  } catch (err) {
    next(err);
  }
};

// --- TRANSFER GIVEAWAY ---
exports.transferGiveaway = async (req, res, next) => {
  try {
    const { senderId, receiverId, amount } = req.body;

    // Prevent self-transfer
    if (senderId === receiverId) {
      const err = new Error("Illegal Operation: You cannot send funds to your own account ID.");
      err.statusCode = 400;
      throw err;
    }

    const transferVal = parseFloat(amount || 0);
    if (transferVal <= 0) {
      const err = new Error("Invalid amount");
      err.statusCode = 400;
      throw err;
    }

    // 1. Fetch both parties
    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    if (!sender || !receiver) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }

    // 2. Sender balance validation
    const senderBalance = parseFloat(sender.amount_paid || 0);
    if (senderBalance - transferVal < TARGET_FEE) {
      const err = new Error(`Insufficient surplus. You must keep ₦${TARGET_FEE} for your own fee.`);
      err.statusCode = 400;
      throw err;
    }

    // 3. Calculate new balances
    const newSenderBalance = senderBalance - transferVal;
    const receiverCurrentBalance = parseFloat(receiver.amount_paid || 0);
    const receiverNewBalance = receiverCurrentBalance + transferVal;

    // 4. Update sender balance
    sender.amount_paid = newSenderBalance;
    await sender.save();

    // 5. Update receiver balance and status
    receiver.amount_paid = receiverNewBalance;
    receiver.status = receiverNewBalance >= TARGET_FEE ? 'paid' : 'pending';
    await receiver.save();

    // 6. Log payment history for both sender and receiver
    const senderFirstName = sender.name ? sender.name.split(' ')[0].toUpperCase() : 'USER';
    const receiverFirstName = receiver.name ? receiver.name.split(' ')[0].toUpperCase() : 'USER';

    await Payment.create([
      {
        camperId: senderId,
        amount: -transferVal,
        reference: `SENT TO ${receiverFirstName}`,
        date: new Date(),
        status: 'transfer_out'
      },
      {
        camperId: receiverId,
        amount: transferVal,
        reference: `FROM ${senderFirstName}`,
        date: new Date(),
        status: 'transfer_in'
      }
    ]);

    res.status(200).json({ 
      success: true, 
      message: 'Transfer successful' 
    });

  } catch (err) {
    next(err);
  }
};