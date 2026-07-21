const User = require('../Model/User');
const Payment = require('../Model/PaymentCol');
const axios = require('axios');

// Constants (match frontend)
const TEAMS = ["KETER", "KAVOD", "KISSEH", "KLIRONOMOS", "ARMON", "SHARBIT", "MALCHUT", "MEMSHALAH"];
const BUSES = ["1", "2", "3", "4", "5"];
const TARGET_FEE = Number(process.env.TARGET_FEE) || 5000;

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

    let transactionId, txRef, camperId;

    // Detect webhook vs manual call
    if (signature && signature === secretHash) {
      transactionId = (body.id || body.data?.id)?.toString();
      txRef = body.tx_ref || body.data?.tx_ref;
      camperId = body.meta?.camper_id || (txRef?.includes('-') ? txRef.split('-')[1] : null);
      console.log(`[WEBHOOK] TX: ${txRef} | Camper: ${camperId}`);
    } else {
      transactionId = body.transaction_id?.toString();
      txRef = body.tx_ref;
      camperId = body.camperId || (txRef?.includes('-') ? txRef.split('-')[1] : null);
      console.log(`[MANUAL] TX: ${txRef} | Camper: ${camperId}`);
    }

    // Validate required data
    if (!transactionId || !camperId) {
      console.error(`[CRITICAL] Missing IDs. TX_ID: ${transactionId}, Camper: ${camperId}`);
      const err = new Error("Incomplete transaction data");
      err.statusCode = 400;
      throw err;
    }

    // --- 2. Verify with Flutterwave ---
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

    // --- 3. Compute net amount (Fixed Naira settlement division bug) ---
    const rawAmount = parseFloat(flwData.data.amount_settled || flwData.data.amount || 0);
    const netAmount = Math.floor(rawAmount / 100) * 100;

    if (netAmount <= 0) {
      console.error(`[CRITICAL] Invalid settled amount: ${netAmount}`);
      const err = new Error("Invalid settlement amount");
      err.statusCode = 400;
      throw err;
    }

    // --- 4. Idempotency: prevent duplicate processing ---
    const existingPayment = await Payment.findOne({ reference: txRef });
    if (existingPayment) {
      console.log(`[DUPLICATE] Blocked for TX: ${transactionId}`);
      return res.status(200).json({ success: true, message: "Transaction already processed" });
    }

    // --- 5. Create Payment record ---
    await Payment.create({
      camperId,
      amount: netAmount,
      reference: txRef,
      date: new Date(),
      status: 'success'
    });

    // --- 6. Fetch and update Camper wallet ---
    const camper = await User.findById(camperId);
    if (!camper) {
      const err = new Error("Camper not found");
      err.statusCode = 404;
      throw err;
    }

    const newBalance = parseFloat(camper.amount_paid || 0) + netAmount;
    camper.amount_paid = newBalance;
    camper.status = newBalance >= TARGET_FEE ? 'paid' : 'pending';

    // --- 7. Logistics assignment (only if reaching target for the first time) ---
    if (newBalance >= TARGET_FEE && !camper.team) {
      const globalPaidCount = await User.countDocuments({ team: { $ne: null } });
      const genderPaidCount = await User.countDocuments({
        gender: camper.gender,
        bed_no: { $ne: null }
      });

      // Round-robin assignments
      camper.team = TEAMS[globalPaidCount % TEAMS.length];
      camper.bus_no = BUSES[globalPaidCount % BUSES.length];

      // Sequential bed assignment per gender
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

    // --- 8. Save camper updates ---
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