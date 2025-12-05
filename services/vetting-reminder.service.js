/**
 * Vetting Reminder Service
 * Sends reminder emails to pending vetters
 */

import cron from 'node-cron';
import Vetter from '../models/vetter.model.js';
import VettingLog from '../models/vetting.log.model.js';
import emailService from '../utils/nodemailer.js';
import User from '../models/user.model.js';
import ContractorProfile from '../models/profile.contractor.model.js';

/**
 * Calculate hours between two dates
 */
const hoursBetween = (date1, date2) => {
    return Math.abs(date1 - date2) / (1000 * 60 * 60);
};

/**
 * Send reminder emails to pending vetters
 */
const sendReminderEmails = async () => {
    try {
        console.log('[Vetting Reminder] Starting reminder email job...');

        // Get reminder interval from env (default: 48 hours)
        const reminderIntervalHours = parseInt(process.env.VETTING_REMINDER_INTERVAL_HOURS) || 48;
        const maxReminders = parseInt(process.env.MAX_VETTING_REMINDERS) || 3;

        // Find pending vetters that need reminders
        const pendingVetters = await Vetter.find({
            status: 'pending',
            deletedAt: null
        }).populate('consultant', 'name email');

        let remindersSent = 0;
        let errors = 0;

        for (const vetter of pendingVetters) {
            try {
                const now = new Date();
                const lastReminderDate = vetter.reminderSentAt || vetter.createdAt;
                const hoursSinceLastReminder = hoursBetween(now, lastReminderDate);

                // Skip if reminder was sent recently
                if (hoursSinceLastReminder < reminderIntervalHours) {
                    continue;
                }

                // Skip if max reminders reached
                if (vetter.reminderCount >= maxReminders) {
                    continue;
                }

                // Check if token is still valid, regenerate if expired
                if (!vetter.isTokenValid()) {
                    const { generateTokenWithExpiry } = await import('../utils/vetting-tokens.js');
                    const { token, expiryDate } = generateTokenWithExpiry(30);
                    vetter.confirmationToken = token;
                    vetter.confirmationTokenExpiry = expiryDate;
                }

                // Get consultant profile for profile URL
                const profile = await ContractorProfile.findOne({ user: vetter.consultant });
                if (!profile) {
                    console.warn(`[Vetting Reminder] Profile not found for consultant ${vetter.consultant._id}`);
                    continue;
                }

                // Prepare email data
                const consultant = vetter.consultant;
                const profileUrl = `${process.env.FRONTEND_URL}/profile/${vetter.consultant._id}`;
                const confirmationUrl = `${process.env.FRONTEND_URL}/vetting/confirm/${vetter.confirmationToken}`;
                const rejectionUrl = `${process.env.FRONTEND_URL}/vetting/reject/${vetter.confirmationToken}`;

                // Send reminder email
                await emailService.sendVettingReminderEmail(
                    vetter.email,
                    consultant.name,
                    profileUrl,
                    confirmationUrl,
                    rejectionUrl
                );

                // Update vetter record
                vetter.reminderSentAt = now;
                vetter.reminderCount = (vetter.reminderCount || 0) + 1;
                await vetter.save();

                // Log action
                try {
                    await VettingLog.create({
                        vetter: vetter._id,
                        consultant: vetter.consultant._id,
                        action: 'reminder_sent',
                        metadata: {
                            reminderCount: vetter.reminderCount
                        }
                    });
                } catch (logError) {
                    console.error('[Vetting Reminder] Error creating log:', logError);
                }

                remindersSent++;
                console.log(`[Vetting Reminder] Sent reminder to ${vetter.email} (reminder #${vetter.reminderCount})`);

            } catch (error) {
                errors++;
                console.error(`[Vetting Reminder] Error sending reminder to ${vetter.email}:`, error);
            }
        }

        console.log(`[Vetting Reminder] Job completed. Sent: ${remindersSent}, Errors: ${errors}`);

    } catch (error) {
        console.error('[Vetting Reminder] Fatal error in reminder service:', error);
    }
};

/**
 * Initialize the reminder cron job
 * Runs every 6 hours to check for pending vetters that need reminders
 */
export const initializeVettingReminderService = () => {
    // Run every 6 hours: '0 */6 * * *'
    // For testing, you can use: '*/30 * * * *' (every 30 minutes)
    const cronSchedule = process.env.VETTING_REMINDER_CRON_SCHEDULE || '0 */6 * * *';

    console.log(`[Vetting Reminder] Initializing reminder service with schedule: ${cronSchedule}`);

    if (process.env.VETTING_REMINDER_RUN_ON_STARTUP === 'true') {
        console.log('[Vetting Reminder] Running initial check on startup...');
        sendReminderEmails();
    }

    // Schedule recurring job
    const job = cron.schedule(cronSchedule, async () => {
        await sendReminderEmails();
    }, {
        scheduled: true,
        timezone: 'America/New_York' // Adjust to your timezone
    });

    console.log('[Vetting Reminder] Reminder service initialized successfully');

    return {
        job,
        sendReminderEmails // Export for manual triggering if needed
    };
};

export default {
    initializeVettingReminderService,
    sendReminderEmails
};