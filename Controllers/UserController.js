const joi = require("joi");
const bcrypt = require("bcrypt");
const Users = require("../Model/User");
const PayRecords = require("../Model/PaymentCol");
const genJWT = require("../utils/genJWT");
const { sendOTPMail } = require("../utils/sendMail");

const signUpSchema = joi.object({
    name: joi.string(),
    email: joi.string().email().required(),
    password: joi.string().min(6).max(8).required(),
    phone: joi.string().pattern(/^[0-9]{10,15}$/),
    gender: joi.valid("Male", "Female")
});

const SignUp = async (req, res, next) => {
    try {
        const { error, value } = signUpSchema.validate(req.body, { abortEarly: false });
        if (error) {
            const err = new Error(error.details[0].message);
            err.statusCode = 400;
            throw err;
        }

        const { name, email, password, phone, gender } = value;

        const existing = await Users.findOne({ email });
        if (existing) {
            const err = new Error("Email already registered");
            err.statusCode = 409;
            throw err;
        }

        const hashedPassword = await bcrypt.hash(password, 13);
        const newUser = await Users.create({
            name,
            email,
            password: hashedPassword,
            phone,
            gender
        });

        if (!newUser) {
            const err = new Error("Error in creating account");
            err.statusCode = 400;
            throw err;
        }

        res.status(201).json({ message: "Account created successfully" });
    } catch (error) {
        next(error); // Passes the thrown error to your custom errorHandler
    }
};

const loginSchema = joi.object({
    email: joi.string().email().required(),
    password: joi.string().min(6).max(8).required()
});

const Login = async (req, res, next) => {
    try {
        const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
        if (error) {
            const err = new Error(error.details[0].message);
            err.statusCode = 400;
            throw err;
        }

        const { email, password } = value;
        const user = await Users.findOne({ email });

        if (!user) {
            const err = new Error("Invalid credentials, Please check your credentials");
            err.statusCode = 401;
            throw err;
        }

        const checkPassword = await bcrypt.compare(password, user.password);
        if (!checkPassword) {
            const err = new Error("Invalid credentials, Please check your credentials");
            err.statusCode = 401;
            throw err;
        }

        res.status(200).json({
            message: "Login Successfully",
            user: {
                id: user._id,
                role: user.role,
                token: genJWT(user._id, "gls")
            }
        });
    } catch (error) {
        next(error);
    }
};

const FetchUserData = async (req, res, next) => {
    try {
        const userData = await Users.findById(req.user._id);
        if (!userData) {
            const err = new Error("User not found");
            err.statusCode = 404;
            throw err;
        }

        const userPayRecord = await PayRecords.find({ camperId: userData._id }).sort({ createdAt: -1 });

        res.status(200).json({
            user: userData,
            camper: userData,
            payments: userPayRecord
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────────────────────────

const ForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required",
            });
        }

        const user = await Users.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000);

        user.otp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        // Send via central sendMail.js
        const sent = await sendOTPMail({ to: user.email, name: user.name, otp });

        if (!sent) {
            return res.status(500).json({
                success: false,
                message: "Failed to send OTP email",
            });
        }

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
        });

    } catch (e) {
        console.error("Forgot password error:", e);
        return res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};

const VerifyOTP = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        // Validate input
        if (!email || !otp || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Email, OTP and new password are required",
            });
        }

        // Find user
        const user = await Users.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Check if OTP exists
        if (!user.otp || !user.otpExpires) {
            return res.status(400).json({
                success: false,
                message: "No OTP request found",
            });
        }

        // Check OTP expiration
        if (Date.now() > user.otpExpires.getTime()) {
            // Clear expired OTP
            user.otp = undefined;
            user.otpExpires = undefined;

            await user.save();

            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new one",
            });
        }

        // Check OTP
        if (Number(otp) !== Number(user.otp)) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP",
            });
        }

        // Validate password length
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters",
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 13);

        // Update password
        user.password = hashedPassword;

        // Clear OTP after successful reset
        user.otp = undefined;
        user.otpExpires = undefined;

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Password reset successfully",
        });

    } catch (error) {
        console.error("Verify OTP error:", error);

        return res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};


module.exports = {
    SignUp,
    Login,
    FetchUserData,
    ForgotPassword ,
    VerifyOTP
};
