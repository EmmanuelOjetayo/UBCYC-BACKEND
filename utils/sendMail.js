const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

const sendResetPasswordMail = async ({
    email,
    name,
    token
}) => {

    const resetLink =
        `${process.env.CLIENT_URL}/reset-password/${token}`;

    const logoUrl =
        "https://fra.cloud.appwrite.io/v1/storage/buckets/698d9d9c000304e95202/files/698f02e9003e14fce7b8/view?project=6985fe2100016c397d59&impersonateuserid=&mode=admin";

    await transporter.sendMail({
        from: `"UBC Youth Camp" <noreply@${process.env.MAIL_USER}>`,
        to: email,
        subject: "Reset Your UBC Youth Camp Password",

        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Password Reset</title>
            </head>

            <body style="
                margin: 0;
                padding: 0;
                background: #f5f3f3;
                font-family: Arial, Helvetica, sans-serif;
            ">

                <div style="
                    max-width: 600px;
                    margin: 40px auto;
                    background: #ffffff;
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 10px 40px rgba(114,47,55,0.12);
                ">

                    <!-- Header -->
                    <div style="
                        background: #742f37;
                        padding: 35px 20px;
                        text-align: center;
                    ">

                        <img
                            src="${logoUrl}"
                            alt="UBC Youth Camp Logo"
                            style="
                                width: 90px;
                                height: 90px;
                                object-fit: contain;
                                display: block;
                                margin: 0 auto 15px;
                                border-radius: 15px;
                            "
                        >

                        <h1 style="
                            margin: 0;
                            color: #ffffff;
                            font-size: 24px;
                            font-weight: 800;
                        ">
                            UBC YOUTH CAMP
                        </h1>

                        <p style="
                            margin: 8px 0 0;
                            color: #D4AF37;
                            font-size: 11px;
                            font-weight: bold;
                            letter-spacing: 2px;
                        ">
                            PASSWORD RECOVERY
                        </p>

                    </div>

                    <!-- Content -->
                    <div style="padding: 40px 30px;">

                        <h2 style="
                            color: #742f37;
                            margin-top: 0;
                            font-size: 22px;
                        ">
                            Reset Your Password
                        </h2>

                        <p style="
                            color: #555555;
                            font-size: 15px;
                            line-height: 1.7;
                        ">
                            Hello ${name || "there"},
                        </p>

                        <p style="
                            color: #555555;
                            font-size: 15px;
                            line-height: 1.7;
                        ">
                            We received a request to reset the password
                            for your UBC Youth Camp account.
                        </p>

                        <p style="
                            color: #555555;
                            font-size: 15px;
                            line-height: 1.7;
                        ">
                            Click the button below to create a new password:
                        </p>

                        <!-- Button -->
                        <div style="
                            text-align: center;
                            margin: 30px 0;
                        ">

                            <a
                                href="${resetLink}"
                                style="
                                    display: inline-block;
                                    background: #742f37;
                                    color: #ffffff;
                                    padding: 15px 28px;
                                    border-radius: 10px;
                                    text-decoration: none;
                                    font-size: 14px;
                                    font-weight: bold;
                                "
                            >
                                RESET MY PASSWORD
                            </a>

                        </div>

                        <div style="
                            background: #faf7f7;
                            border-left: 4px solid #D4AF37;
                            padding: 15px;
                            margin: 25px 0;
                        ">

                            <p style="
                                margin: 0;
                                color: #666666;
                                font-size: 13px;
                                line-height: 1.6;
                            ">
                                This password reset link will expire in
                                <strong>15 minutes</strong>.
                            </p>

                        </div>

                        <p style="
                            color: #777777;
                            font-size: 13px;
                            line-height: 1.6;
                        ">
                            If you did not request this password reset,
                            you can safely ignore this email.
                        </p>

                    </div>

                    <!-- Footer -->
                    <div style="
                        background: #f8f6f6;
                        padding: 25px;
                        text-align: center;
                    ">

                        <p style="
                            margin: 0;
                            color: #742f37;
                            font-size: 13px;
                            font-weight: bold;
                        ">
                            UBC Youth Camp
                        </p>

                        <p style="
                            margin: 6px 0 0;
                            color: #999999;
                            font-size: 11px;
                        ">
                            Youth Camp Portal ${new Date().getFullYear()}
                        </p>

                    </div>

                </div>

            </body>
            </html>
        `
    });

    return true;
};

const sendPresummitAttendanceMail = async ({ email, name, session }) => {
    if (!email) return false;
    try {
        const logoUrl =
            "https://fra.cloud.appwrite.io/v1/storage/buckets/698d9d9c000304e95202/files/698f02e9003e14fce7b8/view?project=6985fe2100016c397d59&impersonateuserid=&mode=admin";

        await transporter.sendMail({
            from: `"GLS Ogbomoso" <noreply@${process.env.MAIL_USER || "glsogbomoso.org"}>`,
            to: email,
            subject: `Checked in for ${session} — GLS Ogbomoso`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Presummit Check-In Confirmation</title>
                </head>
                <body style="
                    margin: 0;
                    padding: 0;
                    background: #f5f3f3;
                    font-family: Arial, Helvetica, sans-serif;
                ">
                    <div style="
                        max-width: 600px;
                        margin: 40px auto;
                        background: #ffffff;
                        border-radius: 20px;
                        overflow: hidden;
                        box-shadow: 0 10px 40px rgba(25,42,56,0.12);
                    ">
                        <!-- Header -->
                        <div style="
                            background: #192A38;
                            padding: 35px 20px;
                            text-align: center;
                        ">
                            <h1 style="
                                margin: 0;
                                color: #ffffff;
                                font-size: 24px;
                                font-weight: 800;
                                letter-spacing: 1px;
                            ">
                                GLS OGBOMOSO
                            </h1>
                            <p style="
                                margin: 8px 0 0;
                                color: #EBB06B;
                                font-size: 11px;
                                font-weight: bold;
                                letter-spacing: 2px;
                            ">
                                ENTRANCE PASS VERIFIED
                            </p>
                        </div>

                        <!-- Content -->
                        <div style="padding: 40px 30px;">
                            <h2 style="
                                color: #192A38;
                                margin-top: 0;
                                font-size: 22px;
                            ">
                                Welcome to ${session}!
                            </h2>
                            <p style="
                                color: #555555;
                                font-size: 15px;
                                line-height: 1.7;
                            ">
                                Hello <strong>${name || "Attendee"}</strong>,
                            </p>
                            <p style="
                                color: #555555;
                                font-size: 15px;
                                line-height: 1.7;
                            ">
                                Your Presummit Entrance Pass for <strong>${session}</strong> has been successfully verified and your attendance is recorded.
                            </p>

                            <div style="
                                background: #f0f7fb;
                                border-left: 4px solid #0090DA;
                                padding: 15px;
                                margin: 25px 0;
                                border-radius: 4px;
                            ">
                                <p style="
                                    margin: 0;
                                    color: #192A38;
                                    font-size: 14px;
                                    line-height: 1.6;
                                ">
                                    <strong>Session:</strong> ${session}<br>
                                    <strong>Status:</strong> Attendance Confirmed<br>
                                    <strong>Time:</strong> ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                            </div>

                            <p style="
                                color: #555555;
                                font-size: 14px;
                                line-height: 1.7;
                            ">
                                We are thrilled to have you join us. Get ready for an inspiring session!
                            </p>
                        </div>

                        <!-- Footer -->
                        <div style="
                            background: #f8f6f6;
                            padding: 25px;
                            text-align: center;
                        ">
                            <p style="
                                margin: 0;
                                color: #192A38;
                                font-size: 13px;
                                font-weight: bold;
                            ">
                                Global Leadership Summit Ogbomoso
                            </p>
                            <p style="
                                margin: 6px 0 0;
                                color: #999999;
                                font-size: 11px;
                            ">
                                GLS Portal ${new Date().getFullYear()}
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            `
        });
        return true;
    } catch (error) {
        console.error("Background presummit email error (non-fatal):", error.message);
        return false;
    }
};

module.exports = {
    sendResetPasswordMail,
    sendPresummitAttendanceMail
};