import { Fund } from '../../models/escrow.model.js';
import Job from '../../models/job.created.model.js';
import User from '../../models/user.model.js';

export const createEscrowForFundedProject = async (jobId, userId, netAmount) => {
  try {
    const job = await Job.findById(jobId);
    const client = await User.findById(userId);

    if (!job || !client) {
      throw new Error('Job or user not found');
    }

    if (!job.isFunded || job.status === 'closed' || job.status === 'completed') {
      throw new Error('Job not in fundable state');
    }

    // Create new fund record with amounts organized by status
    const fund = new Fund({
      jobId: job._id,
      clientId: client._id,
      contractorId: job.freelancerId?._id || null,
      currency: 'usd',
      in_escrow: {
        amount: netAmount,
        date: new Date()
      }
    });

    await fund.save();

    // Update job reference
    job.fund = fund._id;
    await job.save();

    console.log('Fund Created with new schema:', fund);
    return fund;
  } catch (error) {
    console.error('Escrow funding error:', error);
    throw error;
  }
};
