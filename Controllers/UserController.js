const express = require("express");
const joi = require("joi");
const bcrypt = require("bcrypt");
const Users = require("../Model/User");
const PayRecords = require("../Model/PaymentCol");
const genJWT = require("../utilis/genJWT");

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
                token: genJWT(user._id)
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




// Forgotten Password Module
const { BrevoClient } = require("@getbrevo/brevo");


// Generate 6-digit OTP
const genOTP = () => {
    return Math.floor(100000 + Math.random() * 900000);
};


// Brevo client
const brevo = new BrevoClient({
    apiKey: process.env.EMAIL_PASS,
});


// Send forgot password OTP email
const forgotPassMail = async (name, email, otp) => {
    try {

        await brevo.transactionalEmails.sendTransacEmail({

            sender: {
                name: "GLS Ogbomoso",
                email: process.env.EMAIL_USER,
            },

            to: [
                {
                    email: email,
                    name: name || "User",
                }
            ],

            subject: "Password Reset OTP",

            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">

                    <h2>Password Reset</h2>

                    <p>Hello ${name || "User"},</p>

                    <p>
                        We received a request to reset your portal password.
                    </p>

                    <p>Your OTP is:</p>

                    <div style="
                        font-size: 32px;
                        font-weight: bold;
                        letter-spacing: 8px;
                        padding: 20px;
                        background: #f5f5f5;
                        text-align: center;
                        margin: 20px 0;
                    ">
                        ${otp}
                    </div>

                    <p>
                        This OTP will expire in <strong>10 minutes</strong>.
                    </p>

                    <p>
                        If you did not request a password reset, you can safely ignore this email.
                    </p>

                    <p>
                        Regards,<br>
                        <strong>GLS OGBOMOSO Team</strong>
                    </p>

                </div>
            `,
        });

        return true;

    } catch (error) {

        console.error("Brevo email sending error:", error);

        return false;
    }
};

// Forgot Password Controller
const ForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        // Validate email
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required",
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

        // Generate OTP
        const otp = genOTP();

        // Save OTP to user
        user.otp = otp;

        // Optional: save expiration time
        user.otpExpires = Date.now() + 10 * 60 * 1000;

        await user.save();

        // Send email
        const sendMail = await forgotPassMail(
            user.name,
            user.email,
            otp
        );

        // If email failed
        if (!sendMail) {
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
