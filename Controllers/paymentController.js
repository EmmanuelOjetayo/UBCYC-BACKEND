const mongoose = require('mongoose');
const User = require('../Model/User');
const Payment = require('../Model/PaymentCol');
const axios = require('axios');

// Constants (match frontend)
const TEAMS = ["KETER", "KAVOD", "KISSEH", "KLIRONOMOS", "ARMON", "SHARBIT", "MALCHUT", "MEMSHALAH"];
const BUSES = ["1", "2", "3", "4", "5"];
const TARGET_FEE = Number(process.env.TARGET_FEE) || 2000;

/**
 * POST /api/payment/verify
 * - Accepts Flutterwave webhook OR manual call from frontend
 * - Verifies transaction with Flutterwave
 * - Records payment (idempotent)
 * - Updates camper wallet
 * - Assigns team/bus/bed when target reached
 */
exports.verifyPayment = async (req, res, next) => {
  try {
    // --- 1. Extract data from request ---
    const body = req.body;
    const signature = req.headers['verif-hash'];
    const secretHash = process.env.FLW_SECRET_HASH;
    const isWebhook = Boolean(signature && secretHash && signature === secretHash);

    let transactionId, txRef, camperId;

    if (isWebhook) {
      // Flutterwave nests everything under `data` in webhook payloads,
      // including whatever `meta` object was passed at checkout initialization.
      const data = body.data || body;
      transactionId = data.id?.toString();
      txRef = data.tx_ref;
      camperId = data.meta?.camper_id || null;
      console.log(`[WEBHOOK] TX: ${txRef} | Camper: ${camperId}`);
    } else {
      // Manual/callback path: the frontend already knows the logged-in
      // camper's own _id and sends it directly — no parsing required.
      transactionId = body.transaction_id?.toString();
      txRef = body.tx_ref;
      camperId = body.camperId || null;
      console.log(`[MANUAL] TX: ${txRef} | Camper: ${camperId}`);
    }

    // --- 2. Validate required data BEFORE touching the database ---
    if (!transactionId || !txRef || !camperId) {
      console.error(`[CRITICAL] Missing IDs. TX_ID: ${transactionId}, TxRef: ${txRef}, Camper: ${camperId}`);
      const err = new Error("Incomplete transaction data");
      err.statusCode = 400;
      throw err;
    }

    // Reject malformed camperId early — this is what previously let a
    // garbage value ("OGB") slip through and produce a bad Payment record.
    if (!mongoose.Types.ObjectId.isValid(camperId)) {
      console.error(`[CRITICAL] Invalid camperId format: ${camperId} (TX: ${transactionId})`);
      const err = new Error("Invalid camper identifier");
      err.statusCode = 400;
      throw err;
    }

    // --- 3. Verify with Flutterwave (source of truth) ---
    const flwRes = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.FLW_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const flwData = flwRes.data;
    if (flwData.status !== 'success' || flwData.data?.status !== 'successful') {
      console.log(`[FAILED] FLW Verification for TX: ${transactionId}`);
      const err = new Error("Flutterwave verification failed");
      err.statusCode = 400;
      throw err;
    }

    // --- 4. Cross-check: the tx_ref Flutterwave verified must match the one
    // we were given. This prevents a client (on the manual path) from reusing
    // someone else's transaction_id with a different tx_ref/camperId. ---
    if (flwData.data.tx_ref !== txRef) {
      console.error(`[SECURITY] tx_ref mismatch. Expected: ${flwData.data.tx_ref}, Got: ${txRef}`);
      const err = new Error("Transaction reference mismatch");
      err.statusCode = 400;
      throw err;
    }

    // --- 5. Compute net amount (Fixed Naira settlement division bug) ---
    const rawAmount = parseFloat(flwData.data.amount_settled || flwData.data.amount || 0);
    const netAmount = Math.floor(rawAmount / 100) * 100;

    if (netAmount <= 0) {
      console.error(`[CRITICAL] Invalid settled amount: ${netAmount}`);
      const err = new Error("Invalid settlement amount");
      err.statusCode = 400;
      throw err;
    }

    // --- 6. Idempotency: prevent duplicate processing ---
    // Keyed on Flutterwave's own transaction id (immutable, not client-editable)
    // in addition to reference, since reference alone has no unique DB index.
    const existingPayment = await Payment.findOne({
      $or: [{ reference: txRef }, { transactionId }]
    });
    if (existingPayment) {
      console.log(`[DUPLICATE] Blocked for TX: ${transactionId}`);
      return res.status(200).json({ success: true, message: "Transaction already processed" });
    }

    // --- 7. Confirm the camper actually exists BEFORE writing a Payment record ---
    // (Previously Payment.create() ran first, so a bad camperId could still
    // leave a stranded payment record that permanently blocked reprocessing.)
    const camper = await User.findById(camperId);
    if (!camper) {
      console.error(`[CRITICAL] Camper not found: ${camperId} (TX: ${transactionId})`);
      const err = new Error("Camper not found");
      err.statusCode = 404;
      throw err;
    }

    // --- 8. Create Payment record ---
    await Payment.create({
      camperId,
      transactionId,
      amount: netAmount,
      reference: txRef,
      date: new Date(),
      status: 'success'
    });

    // --- 9. Update Camper wallet ---
    const newBalance = parseFloat(camper.amount_paid || 0) + netAmount;
    camper.amount_paid = newBalance;
    camper.status = newBalance >= TARGET_FEE ? 'paid' : 'pending';

    // --- 10. Logistics assignment (only if reaching target for the first time) ---
    if (newBalance >= TARGET_FEE && !camper.team) {
      const globalPaidCount = await User.countDocuments({ team: { $ne: null } });
      const genderPaidCount = await User.countDocuments({
        gender: camper.gender,
        bed_no: { $ne: null }
      });

      camper.team = TEAMS[globalPaidCount % TEAMS.length];
      camper.bus_no = BUSES[globalPaidCount % BUSES.length];

      const prefix = (camper.gender === "Male" || camper.gender === "M") ? "M" : "F";
      let bedNum = genderPaidCount + 1;
      let bedAssigned = false;

      while (!bedAssigned) {
        const candidate = `${prefix}-${String(bedNum).padStart(3, '0')}`;
        const existingBed = await User.findOne({ bed_no: candidate });
        if (!existingBed) {
          camper.bed_no = candidate;
          bedAssigned = true;
        } else {
          bedNum++;
        }
      }

      console.log(`[LOGISTICS] Camper ${camperId} → Team: ${camper.team} | Bus: ${camper.bus_no} | Bed: ${camper.bed_no}`);
    }

    await camper.save();

    console.log(`[COMPLETE] Camper: ${camperId} | New Balance: ₦${newBalance}`);
    return res.status(200).json({
      success: true,
      message: "Wallet Synced",
      credited: netAmount,
      newBalance: camper.amount_paid
    });

  } catch (err) {
    next(err);
  }
};
