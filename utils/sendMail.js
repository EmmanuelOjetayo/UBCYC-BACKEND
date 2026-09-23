// ─────────────────────────────────────────────────────────────
// Central Email Utility — powered by Brevo Transactional API
// All email sending in this backend must go through this file.
// ─────────────────────────────────────────────────────────────

const { BrevoClient } = require("@getbrevo/brevo");

const brevo = new BrevoClient({
    apiKey: process.env.EMAIL_PASS,
});

const SENDER = {
    name: process.env.EMAIL_SENDER_NAME || "GLS Ogbomoso",
    email: process.env.EMAIL_USER,
};

// ─────────────────────────────────────────────────────────────
// CORE: Low-level send function
// All named helpers call this.
// ─────────────────────────────────────────────────────────────

const sendMail = async ({ to, name, subject, htmlContent }) => {
    try {
        await brevo.transactionalEmails.sendTransacEmail({
            sender: SENDER,
            to: [{ email: to, name: name || "User" }],
            subject,
            htmlContent,
        });

        return true;
    } catch (error) {
        console.error("[sendMail] Brevo send error:", error?.message || error);
        return false;
    }
};

// ─────────────────────────────────────────────────────────────
// GLS: OTP Password Reset Email
// ─────────────────────────────────────────────────────────────

const sendOTPMail = async ({ to, name, otp }) => {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(25,42,56,0.10);">

            <div style="background: #192A38; padding: 32px 24px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 900; letter-spacing: 2px;">
                    GLS OGBOMOSO
                </h1>
                <p style="margin: 6px 0 0; color: #8ACCE6; font-size: 11px; font-weight: bold; letter-spacing: 3px; text-transform: uppercase;">
                    Password Recovery
                </p>
            </div>

            <div style="padding: 36px 32px;">
                <h2 style="color: #192A38; margin-top: 0; font-size: 20px;">Reset Your Password</h2>

                <p style="color: #555555; font-size: 15px; line-height: 1.7;">
                    Hello ${name || "Attendee"},
                </p>

                <p style="color: #555555; font-size: 15px; line-height: 1.7;">
                    We received a request to reset your GLS portal password. Use the OTP below to proceed:
                </p>

                <div style="
                    font-size: 36px;
                    font-weight: 900;
                    letter-spacing: 10px;
                    padding: 20px;
                    background: #f0f7fb;
                    border: 2px dashed #0090DA;
                    border-radius: 12px;
                    text-align: center;
                    color: #192A38;
                    margin: 24px 0;
                ">
                    ${otp}
                </div>

                <div style="background: #fff8e1; border-left: 4px solid #C85B33; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0; color: #666; font-size: 13px; line-height: 1.6;">
                        This OTP expires in <strong>10 minutes</strong>. Do not share it with anyone.
                    </p>
                </div>

                <p style="color: #777777; font-size: 13px; line-height: 1.6;">
                    If you did not request this reset, you can safely ignore this email.
                </p>
            </div>

            <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
                <p style="margin: 0; color: #192A38; font-size: 13px; font-weight: bold;">
                    Global Leadership Summit Ogbomoso
                </p>
                <p style="margin: 6px 0 0; color: #999999; font-size: 11px;">
                    ${new Date().getFullYear()} &mdash; Portal System
                </p>
            </div>

        </div>
    `;

    return sendMail({
        to,
        name,
        subject: "Your GLS Password Reset OTP",
        htmlContent,
    });
};

// ─────────────────────────────────────────────────────────────
// UBCYC: Reset Link Email (token-based, used by Youth Camp)
// ─────────────────────────────────────────────────────────────

const sendResetPasswordMail = async ({ email, name, token }) => {
    const resetLink = `${process.env.FRONTEND_URL || process.env.CLIENT_URL}/reset-password/${token}`;

    const logoUrl =
        "https://fra.cloud.appwrite.io/v1/storage/buckets/698d9d9c000304e95202/files/698f02e9003e14fce7b8/view?project=6985fe2100016c397d59&mode=admin";

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset</title>
        </head>
        <body style="margin: 0; padding: 0; background: #f5f3f3; font-family: Arial, Helvetica, sans-serif;">

            <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(114,47,55,0.12);">

                <div style="background: #742f37; padding: 35px 20px; text-align: center;">
                    <img src="${logoUrl}" alt="UBC Youth Camp Logo"
                        style="width: 90px; height: 90px; object-fit: contain; display: block; margin: 0 auto 15px; border-radius: 15px;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800;">UBC YOUTH CAMP</h1>
                    <p style="margin: 8px 0 0; color: #D4AF37; font-size: 11px; font-weight: bold; letter-spacing: 2px;">
                        PASSWORD RECOVERY
                    </p>
                </div>

                <div style="padding: 40px 30px;">
                    <h2 style="color: #742f37; margin-top: 0; font-size: 22px;">Reset Your Password</h2>

                    <p style="color: #555555; font-size: 15px; line-height: 1.7;">Hello ${name || "there"},</p>

                    <p style="color: #555555; font-size: 15px; line-height: 1.7;">
                        We received a request to reset the password for your UBC Youth Camp account.
                    </p>

                    <p style="color: #555555; font-size: 15px; line-height: 1.7;">
                        Click the button below to create a new password:
                    </p>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}"
                            style="display: inline-block; background: #742f37; color: #ffffff; padding: 15px 28px; border-radius: 10px; text-decoration: none; font-size: 14px; font-weight: bold;">
                            RESET MY PASSWORD
                        </a>
                    </div>

                    <div style="background: #faf7f7; border-left: 4px solid #D4AF37; padding: 15px; margin: 25px 0;">
                        <p style="margin: 0; color: #666666; font-size: 13px; line-height: 1.6;">
                            This password reset link will expire in <strong>15 minutes</strong>.
                        </p>
                    </div>

                    <p style="color: #777777; font-size: 13px; line-height: 1.6;">
                        If you did not request this password reset, you can safely ignore this email.
                    </p>
                </div>

                <div style="background: #f8f6f6; padding: 25px; text-align: center;">
                    <p style="margin: 0; color: #742f37; font-size: 13px; font-weight: bold;">UBC Youth Camp</p>
                    <p style="margin: 6px 0 0; color: #999999; font-size: 11px;">
                        Youth Camp Portal ${new Date().getFullYear()}
                    </p>
                </div>

            </div>

        </body>
        </html>
    `;

    return sendMail({
        to: email,
        name,
        subject: "Reset Your UBC Youth Camp Password",
        htmlContent,
    });
};

// ─────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────

module.exports = {
    sendMail,
    sendOTPMail,
    sendResetPasswordMail,
};