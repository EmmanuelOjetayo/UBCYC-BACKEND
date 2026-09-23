const mongoose = require("mongoose");

const PresummitAttendanceSchema = new mongoose.Schema(
    {
        attendeeId: {
            ref: "Users",
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        session: {
            type: String,
            enum: ["Presummit 1", "Presummit 2"],
            required: true
        },
        name: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            default: ""
        },
        email: {
            type: String,
            default: ""
        },
        scannedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// Compound index to guarantee uniqueness per attendee per presummit session
PresummitAttendanceSchema.index({ attendeeId: 1, session: 1 }, { unique: true });

module.exports = mongoose.model(
    "PresummitAttendance",
    PresummitAttendanceSchema
);
