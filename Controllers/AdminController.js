const joi = require("joi");
const MealLogs = require("../Model/MealLogs");
const Souvenirs = require("../Model/Souvenier");
const Users = require("../Model/User");
const Payment = require("../Model/PaymentCol");

// ─────────────────────────────────────────────────────────────
// 1. SCAN SOUVENIR
// ─────────────────────────────────────────────────────────────
const souvenirScanSchema = joi.object({
    camperId: joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
});

const ScanSouvenir = async (req, res, next) => {
    try {
        const { error, value } = souvenirScanSchema.validate(req.body, { abortEarly: false });
        if (error) {
            const err = new Error(error.details[0].message);
            err.statusCode = 400;
            throw err;
        }

        const { camperId } = value;

        // Verify camper exists
        const camper = await Users.findById(camperId);
        if (!camper) {
            const err = new Error("Attendee not found");
            err.statusCode = 404;
            throw err;
        }

        // Check if souvenir already collected
        const existing = await Souvenirs.findOne({ camperId });
        if (existing) {
            const err = new Error("This attendee already received a souvenir.");
            err.statusCode = 409;
            throw err;
        }

        // Create souvenir collection log
        const newSouvenir = await Souvenirs.create({
            camperId: camper._id,
            camperName: camper.name,
            phone: camper.phone,
            collected_at: new Date()
        });

        res.status(201).json({
            success: true,
            message: "Souvenir issued successfully",
            camperName: camper.name,
            log: newSouvenir
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────
// 2. GET SOUVENIR LOGS (For PDF Report)
// ─────────────────────────────────────────────────────────────
const GetSouvenirLogs = async (req, res, next) => {
    try {
        const logs = await Souvenirs.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            logs
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────
// 3. RESET SESSION (End Camping Session)
// ─────────────────────────────────────────────────────────────
const ResetSession = async (req, res, next) => {
    try {
        // Clear transaction & operation logs
        await Payment.deleteMany({});
        await Souvenirs.deleteMany({});
        await MealLogs.deleteMany({});

        // Reset user balances and logistics, keep attendee accounts
        await Users.updateMany({}, {
            $set: {
                amount_paid: 0,
                team: null,
                bus_no: null,
                bed_no: null
            }
        });

        res.status(200).json({
            success: true,
            message: "Session reset successfully. All balances and logs cleared."
        });
    } catch (error) {
        next(error);
    }
};



const GetCampers = async (req, res, next) => {
    try {
        const allCampers = await Users.find();
        res.status(200).json({
            campers: allCampers
        });
    } catch (error) {
        next(error);
    }
};

const GetMealLogs = async (req, res, next) => {
    try {
        const { day } = req.query;
        const todayMealLogs = await MealLogs.find({ day });
        res.status(200).json({
            logs: todayMealLogs
        });
    } catch (error) {
        next(error);
    }
};

const GetSouvenirCount = async (req, res, next) => {
    try {
        const count = await Souvenirs.countDocuments();
        res.status(200).json({
            count
        });
    } catch (error) {
        next(error);
    }
};

const roleSchema = joi.object({
    role: joi.string().valid("user", "admin").required()
});

const RoleUpdate = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { error, value } = roleSchema.validate(req.body, { abortEarly: false });
        
        if (error) {
            const err = new Error(error.details[0].message);
            err.statusCode = 400;
            throw err;
        }

        const { role } = value;
        const foundUser = await Users.findById(id);
        
        if (!foundUser) {
            const err = new Error("User not found");
            err.statusCode = 404;
            throw err;
        }

        foundUser.role = role;
        await foundUser.save();
        
        res.status(200).json({ message: "Role Updated Successfully" });
    } catch (error) {
        next(error);
    }
};

const mealSchema = joi.object({
    camperId: joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    mealType: joi.string().valid("Breakfast", "Lunch", "Dinner").required(),
    day: joi.string().isoDate().required()
});

const ScanMeal = async (req, res, next) => {
    try {
        const { error, value } = mealSchema.validate(req.body, { abortEarly: false });
        
        if (error) {
            const err = new Error(error.details[0].message);
            err.statusCode = 400;
            throw err;
        }

        const { camperId, mealType, day } = value;

        // Check if meal is already logged for this camper today
        const existing = await MealLogs.findOne({ camperId, meal_type: mealType, day });
        if (existing) {
            const err = new Error(`Already received ${mealType} today`);
            err.statusCode = 409;
            throw err;
        }

        const newMealRecord = await MealLogs.create({
            camperId,
            meal_type: mealType,
            day
        });

        res.status(201).json({
            message: `${mealType} logged successfully`,
            log: newMealRecord
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    ScanSouvenir,
    GetSouvenirLogs,
    ResetSession,
    GetCampers,
    GetMealLogs,
    GetSouvenirCount,
    RoleUpdate,
    ScanMeal
};
