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

module.exports = {
    SignUp,
    Login,
    FetchUserData
};