/**
 * HTML Email Templates for GovLink Global
 */

/**
 * Verification Code Email Template
 */
export const verificationCodeEmail = (code) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification Code</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #0B5F94; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">GovLink Global</h1>
      </div>
      
      <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #0B5F94; margin-top: 0;">Email Verification Code</h2>
        
        <p>Hello,</p>
        
        <p>Your authentication code for GovLink Global is:</p>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0B5F94; text-align: center;">
          <p style="margin: 0; font-size: 32px; font-weight: bold; color: #0B5F94; letter-spacing: 5px;">${code}</p>
        </div>
        
        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px;"><strong>Important:</strong> This code will expire in 10 minutes. Please do not share this code with anyone.</p>
        </div>
        
        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          If you did not request this code, please ignore this email or contact us at <a href="mailto:support@govlinkglobal.com" style="color: #0B5F94;">support@govlinkglobal.com</a>
        </p>
        
        <p style="margin-top: 20px; font-size: 12px; color: #999; border-top: 1px solid #ddd; padding-top: 20px;">
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Vetting Request Email Template
 */
export const vettingRequestEmail = (consultantName, profileUrl, confirmationUrl, rejectionUrl, isReminder = false) => {
    const subject = isReminder
        ? `Reminder: Please Confirm ${consultantName}'s GovLink Global Profile`
        : `Please Confirm ${consultantName}'s GovLink Global Profile`;

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #0B5F94; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">GovLink Global</h1>
      </div>
      
      <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #0B5F94; margin-top: 0;">${isReminder ? 'Reminder: ' : ''}Profile Verification Request</h2>
        
        <p>Hello,</p>
        
        <p><strong>${consultantName}</strong> has listed you as a reference to verify their GovLink Global consultant profile. They have worked with you and would like you to confirm the accuracy of their profile information.</p>
        
        <p>To help maintain the integrity of our platform, we need your confirmation before their profile can be activated.</p>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0B5F94;">
          <p style="margin: 0 0 15px 0;"><strong>What you need to do:</strong></p>
          <ol style="margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 10px;">Review their profile by clicking the link below</li>
            <li style="margin-bottom: 10px;">Confirm if the information is accurate</li>
            <li style="margin-bottom: 10px;">Click "Confirm" or "Reject" based on your assessment</li>
          </ol>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${profileUrl}" 
             style="display: inline-block; background-color: #0B5F94; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px; font-weight: bold;">
            View Profile
          </a>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmationUrl}" 
             style="display: inline-block; background-color: #00A871; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; margin: 10px; font-weight: bold; font-size: 16px;">
            ✓ Confirm Profile
          </a>
          
          <a href="${rejectionUrl}" 
             style="display: inline-block; background-color: #dc3545; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; margin: 10px; font-weight: bold; font-size: 16px;">
            ✗ Reject
          </a>
        </div>
        
        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px;"><strong>Note:</strong> Your name and contact information will remain private and will not be displayed on the public profile. Only the number of confirmed vetters will be shown.</p>
        </div>
        
        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          If you have any questions or concerns, please contact us at <a href="mailto:support@govlinkglobal.com" style="color: #0B5F94;">support@govlinkglobal.com</a>
        </p>
        
        <p style="margin-top: 20px; font-size: 12px; color: #999; border-top: 1px solid #ddd; padding-top: 20px;">
          This link will expire in 30 days. If you did not expect this email, please ignore it.
        </p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Vetting Activation Notification Email Template
 */
export const vettingActivationNotificationEmail = (consultantName, vettingCount, frontendUrl) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your GovLink Global Profile is Now Active!</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #00A871; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">🎉 Profile Activated!</h1>
      </div>
      
      <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #0B5F94; margin-top: 0;">Congratulations, ${consultantName}!</h2>
        
        <p>Great news! Your GovLink Global consultant profile has been activated.</p>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00A871;">
          <p style="margin: 0 0 10px 0;"><strong>Your profile status:</strong></p>
          <p style="margin: 0; font-size: 18px; color: #00A871; font-weight: bold;">✓ Active</p>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Verified by ${vettingCount} colleague${vettingCount > 1 ? 's' : ''}</p>
        </div>
        
        <p>Your profile is now visible to clients on GovLink Global. You can start receiving job opportunities and building your professional network.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${frontendUrl}/profile" 
             style="display: inline-block; background-color: #0B5F94; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            View My Profile
          </a>
        </div>
        
        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          Thank you for being part of GovLink Global!
        </p>
      </div>
    </body>
    </html>
  `;
};

