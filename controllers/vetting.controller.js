import Vetter from '../models/vetter.model.js';
import VettingLog from '../models/vetting.log.model.js';
import User from '../models/user.model.js';
import ContractorProfile from '../models/profile.contractor.model.js';
import { generateTokenWithExpiry, isValidTokenFormat } from '../utils/vetting-tokens.js';
import emailService from '../utils/nodemailer.js';
import mongoose from 'mongoose';

const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Get client IP address from request
 */
const getClientIp = (req) => {
    return req.ip ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        'unknown';
};

/**
 * Create a vetting log entry
 */
const createVettingLog = async (vetterId, consultantId, action, metadata = {}, req = null) => {
    try {
        await VettingLog.create({
            vetter: vetterId,
            consultant: consultantId,
            action,
            metadata,
            ipAddress: req ? getClientIp(req) : undefined,
            userAgent: req ? req.headers['user-agent'] : undefined
        });
    } catch (error) {
        console.error('Error creating vetting log:', error);
        // Don't throw - logging is non-critical
    }
};

/**
 * Check if consultant can add more vetters (rate limiting)
 */
const canAddVetter = async (consultantId) => {
    const maxPerDay = parseInt(process.env.MAX_VETTING_REQUESTS_PER_DAY) || 10;
    const maxPending = parseInt(process.env.MAX_PENDING_VETTERS) || 50;

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCount = await Vetter.countDocuments({
        consultant: consultantId,
        createdAt: { $gte: today },
        deletedAt: null
    });

    if (todayCount >= maxPerDay) {
        return { allowed: false, reason: 'Daily limit reached' };
    }

    // Check pending limit
    const pendingCount = await Vetter.countDocuments({
        consultant: consultantId,
        status: 'pending',
        deletedAt: null
    });

    if (pendingCount >= maxPending) {
        return { allowed: false, reason: 'Maximum pending vetters reached' };
    }

    return { allowed: true };
};

/**
 * Activate consultant profile if first vetter confirms
 */
const checkAndActivateProfile = async (consultantId) => {
    const confirmedCount = await Vetter.countDocuments({
        consultant: consultantId,
        status: 'confirmed',
        deletedAt: null
    });

    if (confirmedCount >= 1) {
        const user = await User.findById(consultantId);
        const profile = await ContractorProfile.findOne({ user: consultantId });

        if (user && user.profileStatus === 'pending') {
            user.profileStatus = 'active';
            await user.save();

            if (profile) {
                profile.status = 'active';
                await profile.save();
            }

            // Send activation notification
            try {
                await emailService.sendVettingActivationNotification(
                    user.email,
                    user.name,
                    confirmedCount
                );
            } catch (emailError) {
                console.error('Error sending activation notification:', emailError);
            }

            return true;
        }
    }

    return false;
};

/**
 * Update vetting count on profile
 */
const updateVettingCount = async (consultantId) => {
    const confirmedCount = await Vetter.countDocuments({
        consultant: consultantId,
        status: 'confirmed',
        deletedAt: null
    });

    const profile = await ContractorProfile.findOne({ user: consultantId });
    if (profile) {
        profile.vettingCount = confirmedCount;
        await profile.save();
    }

    return confirmedCount;
};

// ========== CONTROLLER FUNCTIONS ==========

/**
 * Add a new vetter for a consultant
 * POST /api/vetting/add-vetter
 */
export const addVetter = async (req, res, next) => {
    try {
        const { consultantId, name, email, linkedinUrl } = req.body;

        if (!consultantId || !isValidObjectId(consultantId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid consultant ID'
            });
        }

        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: 'Name and email are required'
            });
        }

        // Validate consultant exists and is a contractor
        const consultant = await User.findById(consultantId);
        if (!consultant) {
            return res.status(404).json({
                success: false,
                message: 'Consultant not found'
            });
        }

        if (consultant.role !== 'contractor') {
            return res.status(400).json({
                success: false,
                message: 'Only contractors can add vetters'
            });
        }

        // Prevent consultant from adding themselves
        if (consultant.email.toLowerCase() === email.toLowerCase()) {
            return res.status(400).json({
                success: false,
                message: 'You cannot add yourself as a vetter'
            });
        }

        // Check rate limits
        const rateLimitCheck = await canAddVetter(consultantId);
        if (!rateLimitCheck.allowed) {
            return res.status(429).json({
                success: false,
                message: rateLimitCheck.reason
            });
        }

        // Generate confirmation token
        const { token, expiryDate } = generateTokenWithExpiry(30);

        // Create vetter
        const vetter = await Vetter.create({
            consultant: consultantId,
            name: name.trim(),
            email: email.toLowerCase().trim(),
            linkedinUrl: linkedinUrl?.trim() || '',
            confirmationToken: token,
            confirmationTokenExpiry: expiryDate
        });

        // Log action
        await createVettingLog(vetter._id, consultantId, 'added', {
            name,
            email
        }, req);

        // Send vetting request email
        try {
            const profile = await ContractorProfile.findOne({ user: consultantId });
            const profileUrl = `${process.env.FRONTEND_URL}/profile/${consultantId}`;
            const confirmationUrl = `${process.env.FRONTEND_URL}/vetting/confirm/${token}`;
            const rejectionUrl = `${process.env.FRONTEND_URL}/vetting/reject/${token}`;

            await emailService.sendVettingRequestEmail(
                vetter.email,
                consultant.name,
                profileUrl,
                confirmationUrl,
                rejectionUrl
            );
        } catch (emailError) {
            console.error('Error sending vetting email:', emailError);
            // Continue even if email fails - vetter was created
        }

        res.status(201).json({
            success: true,
            message: 'Vetter added successfully. Confirmation email sent.',
            data: {
                vetter: {
                    _id: vetter._id,
                    name: vetter.name,
                    email: vetter.email,
                    status: vetter.status,
                    createdAt: vetter.createdAt
                }
            }
        });

    } catch (error) {
        if (error.message && error.message.includes('already exists')) {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }

        console.error('Add vetter error:', error);
        next(error);
    }
};

/**
 * Get all vetters for a consultant
 * GET /api/vetting/my-vetters/:consultantId
 */
export const getMyVetters = async (req, res, next) => {
    try {
        const { consultantId } = req.params;

        if (!consultantId || !isValidObjectId(consultantId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid consultant ID'
            });
        }

        const vetters = await Vetter.findActive({
            consultant: consultantId
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: vetters.length,
            data: vetters
        });

    } catch (error) {
        console.error('Get my vetters error:', error);
        next(error);
    }
};

/**
 * Get vetting status for a consultant
 * GET /api/vetting/status/:consultantId
 */
export const getVettingStatus = async (req, res, next) => {
    try {
        const { consultantId } = req.params;

        if (!consultantId || !isValidObjectId(consultantId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid consultant ID'
            });
        }

        const user = await User.findById(consultantId);
        const profile = await ContractorProfile.findOne({ user: consultantId });

        if (!user || !profile) {
            return res.status(404).json({
                success: false,
                message: 'Consultant not found'
            });
        }

        const confirmedCount = await Vetter.countDocuments({
            consultant: consultantId,
            status: 'confirmed',
            deletedAt: null
        });

        const pendingCount = await Vetter.countDocuments({
            consultant: consultantId,
            status: 'pending',
            deletedAt: null
        });

        const rejectedCount = await Vetter.countDocuments({
            consultant: consultantId,
            status: 'rejected',
            deletedAt: null
        });

        res.status(200).json({
            success: true,
            data: {
                profileStatus: user.profileStatus,
                profileActive: profile.status === 'active',
                confirmedCount,
                pendingCount,
                rejectedCount,
                totalCount: confirmedCount + pendingCount + rejectedCount,
                vettingCount: profile.vettingCount || 0
            }
        });

    } catch (error) {
        console.error('Get vetting status error:', error);
        next(error);
    }
};

/**
 * Confirm vetting (public endpoint)
 * POST /api/vetting/confirm/:token
 */
export const confirmVetting = async (req, res, next) => {
    try {
        const { token } = req.params;

        if (!token || !isValidTokenFormat(token)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid confirmation token'
            });
        }

        const vetter = await Vetter.findOne({
            confirmationToken: token,
            deletedAt: null
        });

        if (!vetter) {
            return res.status(404).json({
                success: false,
                message: 'Vetting request not found or expired'
            });
        }

        if (!vetter.isTokenValid()) {
            return res.status(400).json({
                success: false,
                message: 'Confirmation token has expired'
            });
        }

        if (vetter.status === 'confirmed') {
            return res.status(400).json({
                success: false,
                message: 'This vetting request has already been confirmed'
            });
        }

        if (vetter.status === 'rejected') {
            return res.status(400).json({
                success: false,
                message: 'This vetting request has already been rejected'
            });
        }

        // Update vetter status
        vetter.status = 'confirmed';
        vetter.confirmationTimestamp = new Date();
        vetter.confirmationToken = undefined; // Clear token after use
        vetter.confirmationTokenExpiry = undefined;
        await vetter.save();

        // Log action
        await createVettingLog(vetter._id, vetter.consultant, 'confirmed', {}, req);

        // Update vetting count
        const confirmedCount = await updateVettingCount(vetter.consultant);

        // Check and activate profile if first confirmation
        const wasActivated = await checkAndActivateProfile(vetter.consultant);

        // Get consultant info for response
        const consultant = await User.findById(vetter.consultant);

        res.status(200).json({
            success: true,
            message: wasActivated
                ? 'Profile confirmed and activated successfully!'
                : 'Thank you for confirming this profile!',
            data: {
                consultantName: consultant?.name,
                wasActivated,
                confirmedCount
            }
        });

    } catch (error) {
        console.error('Confirm vetting error:', error);
        next(error);
    }
};

/**
 * Reject vetting (public endpoint)
 * POST /api/vetting/reject/:token
 */
export const rejectVetting = async (req, res, next) => {
    try {
        const { token } = req.params;
        const { reason } = req.body; // Optional rejection reason

        if (!token || !isValidTokenFormat(token)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid rejection token'
            });
        }

        const vetter = await Vetter.findOne({
            confirmationToken: token,
            deletedAt: null
        });

        if (!vetter) {
            return res.status(404).json({
                success: false,
                message: 'Vetting request not found or expired'
            });
        }

        if (vetter.status === 'confirmed') {
            return res.status(400).json({
                success: false,
                message: 'This vetting request has already been confirmed'
            });
        }

        if (vetter.status === 'rejected') {
            return res.status(200).json({
                success: true,
                message: 'This vetting request was already rejected'
            });
        }

        // Update vetter status
        vetter.status = 'rejected';
        vetter.confirmationToken = undefined;
        vetter.confirmationTokenExpiry = undefined;
        await vetter.save();

        // Log action
        await createVettingLog(vetter._id, vetter.consultant, 'rejected', {
            reason: reason || 'No reason provided'
        }, req);

        // Get consultant info
        const consultant = await User.findById(vetter.consultant);

        res.status(200).json({
            success: true,
            message: 'Vetting request rejected',
            data: {
                consultantName: consultant?.name
            }
        });

    } catch (error) {
        console.error('Reject vetting error:', error);
        next(error);
    }
};

/**
 * Remove a pending vetter
 * DELETE /api/vetting/remove-vetter/:vetterId
 */
export const removeVetter = async (req, res, next) => {
    try {
        const { vetterId } = req.params;
        const { consultantId } = req.body; // For authorization check

        if (!vetterId || !isValidObjectId(vetterId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid vetter ID'
            });
        }

        const vetter = await Vetter.findById(vetterId);

        if (!vetter || vetter.deletedAt) {
            return res.status(404).json({
                success: false,
                message: 'Vetter not found'
            });
        }

        // Authorization check
        if (consultantId && vetter.consultant.toString() !== consultantId) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to remove this vetter'
            });
        }

        // Only allow removal of pending vetters (or after 7 days if no reminder sent)
        if (vetter.status === 'confirmed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot remove a confirmed vetter'
            });
        }

        // Soft delete
        vetter.deletedAt = new Date();
        await vetter.save();

        // Log action
        await createVettingLog(vetter._id, vetter.consultant, 'removed', {}, req);

        res.status(200).json({
            success: true,
            message: 'Vetter removed successfully'
        });

    } catch (error) {
        console.error('Remove vetter error:', error);
        next(error);
    }
};

/**
 * Resend vetting email
 * POST /api/vetting/resend-email/:vetterId
 */
export const resendVettingEmail = async (req, res, next) => {
    try {
        const { vetterId } = req.params;

        if (!vetterId || !isValidObjectId(vetterId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid vetter ID'
            });
        }

        const vetter = await Vetter.findById(vetterId);

        if (!vetter || vetter.deletedAt) {
            return res.status(404).json({
                success: false,
                message: 'Vetter not found'
            });
        }

        if (vetter.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Can only resend email for pending vetters'
            });
        }

        // Regenerate token if expired
        if (!vetter.isTokenValid()) {
            const { token, expiryDate } = generateTokenWithExpiry(30);
            vetter.confirmationToken = token;
            vetter.confirmationTokenExpiry = expiryDate;
            await vetter.save();
        }

        // Get consultant info
        const consultant = await User.findById(vetter.consultant);
        const profile = await ContractorProfile.findOne({ user: vetter.consultant });

        if (!consultant || !profile) {
            return res.status(404).json({
                success: false,
                message: 'Consultant not found'
            });
        }

        // Send email
        const profileUrl = `${process.env.FRONTEND_URL}/profile/${vetter.consultant}`;
        const confirmationUrl = `${process.env.FRONTEND_URL}/vetting/confirm/${vetter.confirmationToken}`;
        const rejectionUrl = `${process.env.FRONTEND_URL}/vetting/reject/${vetter.confirmationToken}`;

        await emailService.sendVettingRequestEmail(
            vetter.email,
            consultant.name,
            profileUrl,
            confirmationUrl,
            rejectionUrl
        );

        // Log action
        await createVettingLog(vetter._id, vetter.consultant, 'reminder_sent', {}, req);

        res.status(200).json({
            success: true,
            message: 'Vetting email resent successfully'
        });

    } catch (error) {
        console.error('Resend vetting email error:', error);
        next(error);
    }
};

/**
 * Get vetter by token (for public confirmation page)
 * GET /api/vetting/vetter-by-token/:token
 */
export const getVetterByToken = async (req, res, next) => {
    try {
        const { token } = req.params;

        if (!token || !isValidTokenFormat(token)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid token'
            });
        }

        const vetter = await Vetter.findOne({
            confirmationToken: token,
            deletedAt: null
        }).populate('consultant', 'name email');

        if (!vetter) {
            return res.status(404).json({
                success: false,
                message: 'Vetting request not found'
            });
        }

        // Get consultant profile (public info only)
        const profile = await ContractorProfile.findOne({ user: vetter.consultant })
            .select('bio primaryPosition profession location profileImage');

        res.status(200).json({
            success: true,
            data: {
                vetter: {
                    _id: vetter._id,
                    name: vetter.name,
                    status: vetter.status,
                    isTokenValid: vetter.isTokenValid()
                },
                consultant: {
                    name: vetter.consultant.name,
                    profile: profile
                }
            }
        });

    } catch (error) {
        console.error('Get vetter by token error:', error);
        next(error);
    }
};


