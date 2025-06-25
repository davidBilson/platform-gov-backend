import {
  Fund,
  EscrowAccount,
  Transaction,
} from '../../models/escrow.model.js';
import Job from '../../models/job.created.model.js';
import User from '../../models/user.model.js';
import Transactions from '../../models/transactions.model.js';

export const createEscrowForFundedProject = async (jobId, userId) => {
  try {
    const job = await Job.findById(jobId);
    const client = await User.findById(userId);

    if (!job || !client) {
      throw new Error('Job or user not found');
    }

    if (!job.isFunded || job.status === 'closed' || job.status === 'completed') {
      throw new Error('Job not in fundable state');
    }

    // Find funding transaction
    const fundingTransaction = await Transactions.findOne({
      jobId: job._id,
      type: 'project_funding',
      status: 'completed'
    });

    console.log('Funding Transaction:', fundingTransaction);

    if (!fundingTransaction) {
      throw new Error('Funding transaction not found');
    }

    const escrowAmount = fundingTransaction.netAmount;

    console.log('Escrow Amount:', escrowAmount);

    // Find or create escrow account
    let escrowAccount = await EscrowAccount.findOne({ client_id: client._id });
    if (!escrowAccount) {
      escrowAccount = new EscrowAccount({
        client_id: client._id,
        balance: 0,
        currency: 'usd'
      });
    }

    console.log('Escrow Account:', escrowAccount);

    // Add funds to escrow
    escrowAccount.addFunds(escrowAmount);
    await escrowAccount.save();

    // Create fund record
    const fund = new Fund({
      job_id: job._id,
      client_id: client._id,
      contractor_id: job.freelancerId?._id || null,
      amount: escrowAmount,
      currency: 'usd',
      status: 'in_escrow'
    });
    await fund.save();

    console.log('Fund Created:', fund);

    // Update job reference
    job.fund = fund._id;
    await job.save();

    // Create escrow transaction
    const escrowTransaction = new Transaction({
      fund_id: fund._id,
      type: 'fund',
      amount: escrowAmount,
      currency: 'usd',
      initiated_by: client._id,
      status: 'completed',
      notes: `Escrow funding for job: ${job.jobTitle}`
    });
    await escrowTransaction.save();

    console.log('Escrow Transaction Created:', escrowTransaction);

    return { fund, escrowAccount, escrowTransaction };
  } catch (error) {
    console.error('Escrow funding error:', error);
    throw error;
  }
};