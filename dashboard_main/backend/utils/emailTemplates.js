const PASSWORD_RESET_SUCCESS_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Successful</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  <div style="background-color: #1e628c; padding: 24px 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Password Reset Successful</h1>
  </div>

  <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="margin: 16px 0; color: #4b5563;">Hello,</p>

    <p style="margin: 16px 0; color: #4b5563;">Your password has been successfully reset.</p>

    <div style="text-align: center; margin: 30px 0;">
      <div style="display: inline-block; width: 60px; height: 60px; background-color: #10b981; border-radius: 50%; color: white; font-size: 30px; line-height: 60px;">✓</div>
    </div>

    <p style="margin: 16px 0; color: #4b5563;">You can now sign in to your account with your new password.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="https://rapidroutines.org/dashboard/login" style="background-color: #1e628c; color: white; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; display: inline-block;">Sign In</a>
    </div>

    <p style="margin: 16px 0; color: #4b5563;">If you did not reset your password, please contact us immediately at support@rapidroutines.org.</p>

    <div style="margin: 25px 0; padding: 15px; background-color: #f3f4f6; border-radius: 8px;">
      <p style="margin: 0 0 10px 0; color: #4b5563; font-weight: 600;">Security Recommendations:</p>
      <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
        <li style="margin-bottom: 8px;">Use a unique password</li>
        <li style="margin-bottom: 8px;">Never share your password</li>
        <li style="margin-bottom: 8px;">Update your password regularly</li>
      </ul>
    </div>

    <p style="margin: 24px 0 16px 0; color: #4b5563;">Thank you,<br>The RapidRoutines Team</p>
  </div>

  <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 13px;">
    <p style="margin: 5px 0;">© 2025 RapidRoutines. All rights reserved.</p>
    <p style="margin: 5px 0;">This is a transactional email related to your account.</p>
  </div>
</body>
</html>
`;

const PASSWORD_RESET_REQUEST_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  <div style="background-color: #1e628c; padding: 24px 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Reset Your Password</h1>
  </div>

  <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="margin: 16px 0; color: #4b5563;">Hello,</p>

    <p style="margin: 16px 0; color: #4b5563;">We received a request to reset your password. Click the button below to create a new password:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="{resetURL}" style="background-color: #1e628c; color: white; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; display: inline-block;">Reset Password</a>
    </div>

    <div style="margin: 25px 0; padding: 12px 15px; background-color: #f3f4f6; border-left: 4px solid #1e628c; border-radius: 3px;">
      <p style="margin: 0; color: #4b5563; font-size: 14px;">This link will expire in 1 hour.</p>
    </div>

    <p style="margin: 16px 0; color: #4b5563;">If you didn't request this change, you can ignore this email and your password will remain the same.</p>

    <p style="margin: 24px 0 16px 0; color: #4b5563;">Thank you,<br>The RapidRoutines Team</p>
  </div>

  <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 13px;">
    <p style="margin: 5px 0;">© 2025 RapidRoutines. All rights reserved.</p>
    <p style="margin: 5px 0;">This is a transactional email related to your account.</p>
  </div>
</body>
</html>
`;

const WELCOME_EMAIL_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to RapidRoutines</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  <div style="background-color: #1e628c; padding: 24px 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Welcome to RapidRoutines</h1>
  </div>

  <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="margin: 16px 0; color: #4b5563;">Hello {name},</p>

    <p style="margin: 16px 0; color: #4b5563;">Thank you for joining RapidRoutines! Your account has been successfully created and you're ready to start your fitness journey.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="https://rapidroutines.org/dashboard" style="background-color: #1e628c; color: white; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; display: inline-block;">Go to Dashboard</a>
    </div>

    <table style="width: 100%; border-collapse: separate; border-spacing: 10px; margin: 20px 0;">
      <tr>
        <td style="width: 50%; padding: 15px; background-color: #f3f4f6; border-radius: 8px; text-align: center; vertical-align: top;">
          <p style="margin: 0; font-weight: 600; color: #1e628c;">AI Chatbot</p>
          <p style="margin: 5px 0 0; font-size: 14px; color: #6b7280;">Get personalized fitness advice</p>
        </td>
        <td style="width: 50%; padding: 15px; background-color: #f3f4f6; border-radius: 8px; text-align: center; vertical-align: top;">
          <p style="margin: 0; font-weight: 600; color: #1e628c;">Progress Tracking</p>
          <p style="margin: 5px 0 0; font-size: 14px; color: #6b7280;">Monitor your improvements</p>
        </td>
      </tr>
      <tr>
        <td style="width: 50%; padding: 15px; background-color: #f3f4f6; border-radius: 8px; text-align: center; vertical-align: top;">
          <p style="margin: 0; font-weight: 600; color: #1e628c;">Exercise Library</p>
          <p style="margin: 5px 0 0; font-size: 14px; color: #6b7280;">Browse workout guides</p>
        </td>
        <td style="width: 50%; padding: 15px; background-color: #f3f4f6; border-radius: 8px; text-align: center; vertical-align: top;">
          <p style="margin: 0; font-weight: 600; color: #1e628c;">RepBot</p>
          <p style="margin: 5px 0 0; font-size: 14px; color: #6b7280;">AI-powered rep counting</p>
        </td>
      </tr>
    </table>

    <p style="margin: 24px 0 16px 0; color: #4b5563;">We're thrilled to have you on board and look forward to helping you achieve your fitness goals.</p>

    <p style="margin: 16px 0; color: #4b5563;">Thanks,<br>The RapidRoutines Team</p>
  </div>

  <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 13px;">
    <p style="margin: 5px 0;">© 2025 RapidRoutines. All rights reserved.</p>
    <p style="margin: 5px 0;">123 Fitness Street, Exercise City</p>
    <p style="margin: 5px 0;">This is a transactional email related to your account registration.</p>
  </div>
</body>
</html>
`;

module.exports = {
  PASSWORD_RESET_SUCCESS_TEMPLATE,
  PASSWORD_RESET_REQUEST_TEMPLATE,
  WELCOME_EMAIL_TEMPLATE,
};
