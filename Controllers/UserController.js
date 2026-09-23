const express = require("express");
const joi = require("joi");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const Users = require("../Model/User");
const ycampers = require("../Model/YCampers");

const PayRecords = require("../Model/PaymentCol");
const ypayment = require("../Model/YPayment");

const genJWT = require("../utils/genJWT");
const { sendResetPasswordMail } = require("../utils/sendMail");

/*
|--------------------------------------------------------------------------
| SIGN UP
|--------------------------------------------------------------------------
*/

const signUpSchema = joi.object({
  name: joi.string(),
  email: joi.string().email().required(),
  password: joi.string().min(6).max(8).required(),
  phone: joi.string().pattern(/^[0-9]{10,15}$/),
  gender: joi.valid("Male", "Female"),
  type: joi.string()
});

const SignUp = async (req, res, next) => {
  try {
    const { error, value } = signUpSchema.validate(req.body, { abortEarly: false });

    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      throw err;
    }

    const { name, email, password, phone, gender, type } = value;

    if (type === "ubcyc") {
      const existing = await ycampers.findOne({ email, type: "ubcyc" });

      if (existing) {
        const err = new Error("Email already registered");
        err.statusCode = 409;
        throw err;
      }

      const hashedPassword = await bcrypt.hash(password, 13);

      const newCamper = await ycampers.create({
        name,
        email,
        password: hashedPassword,
        phone,
        gender,
        type: "ubcyc"
      });

      if (!newCamper) {
        const err = new Error("Error in creating account");
        err.statusCode = 400;
        throw err;
      }

      return res.status(201).json({ message: "Account created successfully" });
    }

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
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

const loginSchema = joi.object({
  email: joi.string().email().required(),
  password: joi.string().min(6).max(8).required(),
  type: joi.string()
});

const Login = async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body, { abortEarly: false });

    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      throw err;
    }

    const { email, password, type } = value;

    if (type === "ubcyc") {
      const user = await ycampers.findOne({ email, type: "ubcyc" });

      if (!user) {
        const err = new Error("Invalid credentials, Please check your credentials");
        err.statusCode = 401;
        throw err;
      }

      if (!user.password) {
        const err = new Error("We have upgraded our system, kindly reset your password");
        err.statusCode = 400;
        throw err;
      }

      const checkPassword = await bcrypt.compare(password, user.password);

      if (!checkPassword) {
        const err = new Error("Invalid credentials, Please check your credentials");
        err.statusCode = 401;
        throw err;
      }

      return res.status(200).json({
        message: "Login Successfully",
        user: {
          id: user._id,
          role: user.role,
          type: "ubcyc",
          token: genJWT(user._id, "ubcyc")
        }
      });
    }

    const user = await Users.findOne({ email });

    if (!user) {
      const err = new Error("Invalid credentials, Please check your credentials");
      err.statusCode = 401;
      throw err;
    }

    if (!user.password) {
      const err = new Error("We have upgraded our system, kindly reset your password");
      err.statusCode = 400;
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
        type: "gls",
        token: genJWT(user._id, "gls")
      }
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| FETCH USER DATA
|--------------------------------------------------------------------------
*/

const FetchUserData = async (req, res, next) => {
  try {
    const type = req.user.type;

    if (type === "ubcyc") {
      const userData = await ycampers.findById(req.user._id);

      if (!userData) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
      }

      const userPayRecord = await ypayment
        .find({ camperId: userData._id, type: "ubcyc" })
        .sort({ createdAt: -1 });

      return res.status(200).json({
        user: userData,
        camper: userData,
        payments: userPayRecord
      });
    }

    const userData = await Users.findById(req.user._id);

    if (!userData) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }

    const userPayRecord = await PayRecords.find({ camperId: userData._id }).sort({ createdAt: -1 });

    return res.status(200).json({
      user: userData,
      camper: userData,
      payments: userPayRecord
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| FORGOT PASSWORD
|--------------------------------------------------------------------------
*/

const forgotPasswordSchema = joi.object({
  email: joi.string().email().required(),
  type: joi.string()
});

const ForgotPassword = async (req, res, next) => {
  try {
    const { error, value } = forgotPasswordSchema.validate(req.body);

    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      throw err;
    }

    const { email, type } = value;
    const Model = type === "ubcyc" ? ycampers : Users;

    const user = await Model.findOne(
      type === "ubcyc" ? { email, type: "ubcyc" } : { email }
    );

    if (!user) {
      return res.status(200).json({
        message: "If an account exists with this email, a password reset link has been sent."
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = expiry;
    await user.save();

    await sendResetPasswordMail({
      email: user.email,
      name: user.name,
      token: rawToken
    });

    res.status(200).json({
      message: "If an account exists with this email, a password reset link has been sent."
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| RESET PASSWORD
|--------------------------------------------------------------------------
*/

const resetPasswordSchema = joi.object({
  password: joi.string().min(6).max(8).required(),
  type: joi.string()
});

const ResetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token) {
      const err = new Error("Reset token is required");
      err.statusCode = 400;
      throw err;
    }

    const { error, value } = resetPasswordSchema.validate(req.body);

    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      throw err;
    }

    const { password, type } = value;
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const Model = type === "ubcyc" ? ycampers : Users;

    const user = await Model.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
      ...(type === "ubcyc" ? { type: "ubcyc" } : {})
    });

    if (!user) {
      const err = new Error("Invalid or expired reset link");
      err.statusCode = 400;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(password, 13);

    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  SignUp,
  Login,
  FetchUserData,
  ForgotPassword,
  ResetPassword
};