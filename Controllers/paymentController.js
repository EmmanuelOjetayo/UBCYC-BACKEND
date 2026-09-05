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

    let transactionId, txRef, camperId, resolutionMethod;

    if (isWebhook) {
      const data = body.data || body;
      transactionId = data.id?.toString();
      txRef = data.tx_ref;

      // Guard 1: meta.camper_id (primary, most trustworthy — set by us at init)
      if (data.meta?.camper_id) {
        camperId = data.meta.camper_id;
        resolutionMethod = 'meta.camper_id';
      } else {
        console.warn(`[GUARD 1 FAILED] meta.camper_id missing. TX: ${transactionId} | TxRef: ${txRef}`);
      }

      // Guard 2: meta.camperId (alt casing fallback)
      if (!camperId && data.meta?.camperId) {
        camperId = data.meta.camperId;
        resolutionMethod = 'meta.camperId (alt casing)';
        console.warn(`[GUARD 2 USED] Resolved via alt-case meta field. TX: ${transactionId}`);
      } else if (!camperId) {
        console.warn(`[GUARD 2 FAILED] meta.camperId (alt casing) also missing. TX: ${transactionId}`);
      }

      console.log(`[WEBHOOK] TX: ${txRef} | Camper (pre-verify): ${camperId || 'UNRESOLVED'}`);
    } else {
      // Manual/callback path: the frontend already knows the logged-in
      // camper's own _id and sends it directly — no parsing required.
      transactionId = body.transaction_id?.toString();
      txRef = body.tx_ref;
      camperId = body.camperId || null;
      resolutionMethod = 'body.camperId (manual)';
      console.log(`[MANUAL] TX: ${txRef} | Camper: ${camperId}`);
    }

    // --- 2. Validate the minimum needed to even call Flutterwave ---
    // NOTE: camperId is intentionally NOT required yet on the webhook path —
    // Guards 3/4 below still get a chance to resolve it using verified data.
    if (!transactionId || !txRef) {
      console.error(`[CRITICAL] Missing transaction identifiers. TX_ID: ${transactionId}, TxRef: ${txRef}`);
      const err = new Error("Incomplete transaction data");
      err.statusCode = 400;
      throw err;
    }

    // On the manual path camperId IS required immediately — there's no
    // verify-response fallback available/needed for it, it's just client-supplied.
    if (!isWebhook && !camperId) {
      console.error(`[CRITICAL] Manual call missing camperId. TX: ${transactionId}`);
      const err = new Error("Incomplete transaction data");
      err.statusCode = 400;
      throw err;
    }

    // --- 3. Verify with Flutterwave (source of truth) ---
    let flwData;
    try {
      const flwRes = await axios.get(
        `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.FLW_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      flwData = flwRes.data;
    } catch (flwError) {
      console.error(`[FLW VERIFY ERROR] TX: ${transactionId} | Status: ${flwError.response?.status} | Message: ${flwError.response?.data?.message || flwError.message}`);
      const err = new Error("Flutterwave verification request failed");
      err.statusCode = 502;
      throw err;
    }

    if (flwData.status !== 'success' || flwData.data?.status !== 'successful') {
      console.log(`[FAILED] FLW Verification for TX: ${transactionId}`);
      const err = new Error("Flutterwave verification failed");
      err.statusCode = 400;
      throw err;
    }

    // --- 3b. Webhook-only: try to resolve camperId further using verified data ---
    if (isWebhook && !camperId) {
      // Guard 3: match by verified customer email (reliable regardless of payment method)
      if (flwData.data?.customer?.email) {
        const emailMatch = await User.findOne({ email: flwData.data.customer.email });
        if (emailMatch) {
          camperId = emailMatch._id.toString();
          resolutionMethod = 'customer.email';
          console.warn(`[GUARD 3 USED] Resolved via email match: ${flwData.data.customer.email} → ${camperId}`);
        } else {
          console.warn(`[GUARD 3 FAILED] No camper found for email: ${flwData.data.customer.email}. TX: ${transactionId}`);
        }
      } else {
        console.warn(`[GUARD 3 FAILED] Flutterwave returned no customer.email. TX: ${transactionId}`);
      }

      // Guard 4: match by verified customer phone number (weaker, last resort)
      if (!camperId && flwData.data?.customer?.phone_number) {
        const phoneMatch = await User.findOne({ phone: flwData.data.customer.phone_number });
        if (phoneMatch) {
          camperId = phoneMatch._id.toString();
          resolutionMethod = 'customer.phone_number';
          console.warn(`[GUARD 4 USED] Resolved via phone match: ${flwData.data.customer.phone_number} → ${camperId}`);
        } else {
          console.warn(`[GUARD 4 FAILED] No camper found for phone: ${flwData.data.customer.phone_number}. TX: ${transactionId}`);
        }
      } else if (!camperId) {
        console.warn(`[GUARD 4 FAILED] Flutterwave returned no customer.phone_number. TX: ${transactionId}`);
      }

      // Final: every guard exhausted — dump everything for manual review
      if (!camperId) {
        console.error(`[UNRESOLVED] Could not identify camper after all guards. TX: ${transactionId} | TxRef: ${txRef}`);
        console.error(`[FLW RAW WEBHOOK BODY]`, JSON.stringify(body, null, 2));
        console.error(`[FLW VERIFY RESPONSE]`, JSON.stringify(flwData, null, 2));
        const err = new Error("Could not identify camper for this transaction");
        err.statusCode = 400;
        throw err;
      }

      console.log(`[RESOLVED via ${resolutionMethod}] Camper: ${camperId} | TX: ${transactionId}`);
    }

    // Reject malformed camperId — stops a bad value from ever reaching Payment.create()
    if (!mongoose.Types.ObjectId.isValid(camperId)) {
      console.error(`[CRITICAL] Invalid camperId format: ${camperId} (TX: ${transactionId})`);
      const err = new Error("Invalid camper identifier");
      err.statusCode = 400;
      throw err;
    }

    // --- 4. Cross-check: the tx_ref Flutterwave verified must match the one we were given ---
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
    const existingPayment = await Payment.findOne({
      $or: [{ reference: txRef }, { transactionId }]
    });
    if (existingPayment) {
      console.log(`[DUPLICATE] Blocked for TX: ${transactionId}`);
      return res.status(200).json({ success: true, message: "Transaction already processed" });
    }

    // --- 7. Confirm the camper actually exists BEFORE writing a Payment record ---
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
