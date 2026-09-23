const joi = require("joi");
const MealLogs = require("../Model/YMealLogs");
const Souvenirs = require("../Model/YSouvenir");
const Users = require("../Model/User");
const PresummitAttendance = require("../Model/PresummitAttendance");
const PayRecords = require("../Model/PaymentCol");
const { sendPresummitAttendanceMail } = require("../utils/sendMail");

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

const GetSouvenirLogs = async (req, res, next) => {
    try {
        const logs = await Souvenirs.find().sort({ createdAt: -1 });
        res.status(200).json({
            logs
        });
    } catch (error) {
        next(error);
    }
};

const ScanSouvenir = async (req, res, next) => {
    try {
        const camperId = req.body.camperId || req.body.qrData;
        if (!camperId) {
            const err = new Error("Attendee ID is required");
            err.statusCode = 400;
            throw err;
        }

        const camper = await Users.findById(camperId);
        if (!camper) {
            const err = new Error("Attendee not found");
            err.statusCode = 404;
            throw err;
        }

        const existing = await Souvenirs.findOne({ camperId: camper._id });
        if (existing) {
            const err = new Error("This attendee already received a souvenir");
            err.statusCode = 409;
            throw err;
        }

        await Souvenirs.create({
            camperId: camper._id,
            camperName: camper.name,
            phone: camper.phone,
            collected_at: new Date()
        });

        res.status(200).json({
            message: "Souvenir collected successfully",
            camperName: camper.name
        });
    } catch (error) {
        next(error);
    }
};

const ResetSession = async (req, res, next) => {
    try {
        await PayRecords.deleteMany({});
        await Souvenirs.deleteMany({});
        await PresummitAttendance.deleteMany({});
        await Users.updateMany({}, { $set: { amount_paid: 0 } });

        res.status(200).json({
            success: true,
            message: "Session reset successfully"
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

/*
|--------------------------------------------------------------------------
| PRESUMMIT ATTENDANCE CONTROLLERS
|--------------------------------------------------------------------------
*/

const presummitScanSchema = joi.object({
    qrData: joi.string().required(),
    session: joi.string().valid("Presummit 1", "Presummit 2").required()
});

const ScanPresummit = async (req, res, next) => {
    try {
        const { error, value } = presummitScanSchema.validate(req.body, { abortEarly: false });
        if (error) {
            const err = new Error("Invalid Presummit Pass");
            err.statusCode = 400;
            throw err;
        }

        const { qrData, session } = value;

        // Extract attendee ID from qrData
        let extractedId = qrData.trim();
        if (extractedId.startsWith("{") && extractedId.endsWith("}")) {
            try {
                const parsed = JSON.parse(extractedId);
                extractedId = parsed.attendeeId || parsed.id || parsed._id || extractedId;
            } catch {
                // Keep extractedId as is
            }
        }

        // Validate ObjectId format (24 hex characters)
        if (!/^[0-9a-fA-F]{24}$/.test(extractedId)) {
            const err = new Error("Invalid Presummit Pass");
            err.statusCode = 400;
            throw err;
        }

        // Find Attendee
        const attendee = await Users.findById(extractedId);
        if (!attendee) {
            const err = new Error("Attendee not found");
            err.statusCode = 404;
            throw err;
        }

        // Check if already attended this specific presummit
        const existingAttendance = await PresummitAttendance.findOne({
            attendeeId: attendee._id,
            session
        });

        if (existingAttendance) {
            const err = new Error(`Already recorded for ${session}`);
            err.statusCode = 409;
            throw err;
        }

        // Record attendance
        const newAttendance = await PresummitAttendance.create({
            attendeeId: attendee._id,
            session,
            name: attendee.name || "Attendee",
            phone: attendee.phone || "",
            email: attendee.email || "",
            scannedAt: new Date()
        });

        // Trigger background async email immediately (< 5s requirement & non-blocking)
        setImmediate(async () => {
            try {
                if (attendee.email) {
                    await sendPresummitAttendanceMail({
                        email: attendee.email,
                        name: attendee.name,
                        session
                    });
                }
            } catch (mailErr) {
                console.error("Presummit email background dispatch error:", mailErr.message);
            }
        });

        return res.status(201).json({
            success: true,
            message: `${session} attendance recorded successfully`,
            attendee: {
                id: attendee._id,
                name: attendee.name,
                phone: attendee.phone || "",
                session,
                scannedAt: newAttendance.scannedAt
            }
        });

    } catch (error) {
        next(error);
    }
};

const GetPresummitCounts = async (req, res, next) => {
    try {
        const [presummit1Count, presummit2Count, distinctAttendees] = await Promise.all([
            PresummitAttendance.countDocuments({ session: "Presummit 1" }),
            PresummitAttendance.countDocuments({ session: "Presummit 2" }),
            PresummitAttendance.distinct("attendeeId")
        ]);

        res.status(200).json({
            success: true,
            presummit1: presummit1Count,
            presummit2: presummit2Count,
            overall: distinctAttendees.length
        });
    } catch (error) {
        next(error);
    }
};

const GetPresummitLogs = async (req, res, next) => {
    try {
        const { session } = req.query;

        if (session === "Presummit 1" || session === "Presummit 2") {
            const records = await PresummitAttendance.find({ session })
                .sort({ scannedAt: 1 });

            const participants = records.map((record) => ({
                name: record.name,
                phone: record.phone || ""
            }));

            return res.status(200).json({
                success: true,
                session,
                count: participants.length,
                participants
            });
        }

        // Overall Presummit Participants (deduplicated)
        const allRecords = await PresummitAttendance.find()
            .sort({ scannedAt: 1 });

        const seenAttendeeIds = new Set();
        const overallParticipants = [];

        for (const record of allRecords) {
            const idStr = String(record.attendeeId);
            if (!seenAttendeeIds.has(idStr)) {
                seenAttendeeIds.add(idStr);
                overallParticipants.push({
                    name: record.name,
                    phone: record.phone || ""
                });
            }
        }

        return res.status(200).json({
            success: true,
            session: "Overall",
            count: overallParticipants.length,
            participants: overallParticipants
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    GetCampers,
    GetMealLogs,
    GetSouvenirCount,
    GetSouvenirLogs,
    ScanSouvenir,
    ResetSession,
    RoleUpdate,
    ScanMeal,
    ScanPresummit,
    GetPresummitCounts,
    GetPresummitLogs
};