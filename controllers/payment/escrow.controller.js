import {
  Fund,
  EscrowAccount,
  Transaction,
  Dispute,
  FUND_STATUS,
  TRANSACTION_TYPE,
  TRANSACTION_STATUS,
  DISPUTE_STATUS
} from '../../models/escrow.model.js';
import Job from '../../models/job.created.model.js';
import User from '../../models/user.model.js';
import Transactions from '../../models/transactions.model.js';
import { stripe } from './payment.controller.js';

  
// escrow.controller.js
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
      freelancer_id: job.freelancerId?._id || null,
      amount: escrowAmount,
      currency: 'usd',
      status: 'available'
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
  
export const submitWork = async (req, res) => {
    try {
      const { fundId } = req.body;
      const fund = await Fund.findById(fundId);
  
      if (!fund) {
        return res.status(404).json({ success: false, message: 'Fund not found' });
      }
  
      if (fund.status !== FUND_STATUS.IN_PROGRESS) {
        return res.status(400).json({ 
          success: false, 
          message: 'Work can only be submitted when fund is in progress' 
        });
      }
  
      fund.status = FUND_STATUS.PENDING_REVIEW;
      fund.work_submitted_at = new Date();
      await fund.save();
  
      res.status(200).json({ success: true, fund });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Work submission failed',
        error: error.message 
      });
    }
  };
  
  export const reviewWork = async (req, res) => {
    try {
      const { fundId, action } = req.body; // action: 'approve', 'revision', 'reject'
      const fund = await Fund.findById(fundId);
  
      if (!fund) {
        return res.status(404).json({ success: false, message: 'Fund not found' });
      }
  
      if (fund.status !== FUND_STATUS.PENDING_REVIEW) {
        return res.status(400).json({ 
          success: false, 
          message: 'Work not in reviewable state' 
        });
      }
  
      switch (action) {
        case 'approve':
          fund.status = FUND_STATUS.IN_REVIEW;
          break;
        case 'revision':
          fund.status = FUND_STATUS.IN_PROGRESS;
          break;
        case 'reject':
          // Stays in pending_review until dispute is created
          break;
        default:
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid review action' 
          });
      }
  
      await fund.save();
      res.status(200).json({ success: true, fund });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Work review failed',
        error: error.message 
      });
    }
  };
  
  // Freelancer requests withdrawal
  export const requestWithdrawal = async (req, res) => {
    try {
      const { fundId } = req.body;
      const fund = await Fund.findById(fundId);
  
      if (!fund) {
        return res.status(404).json({ success: false, message: 'Fund not found' });
      }
  
      if (fund.status !== FUND_STATUS.IN_REVIEW) {
        return res.status(400).json({ 
          success: false, 
          message: 'Withdrawal can only be requested when fund is in review' 
        });
      }
  
      // Create withdrawal request transaction
      const transaction = new Transaction({
        fund_id: fund._id,
        type: TRANSACTION_TYPE.RELEASE,
        amount: fund.amount,
        currency: fund.currency,
        initiated_by: fund.freelancer_id,
        status: TRANSACTION_STATUS.PENDING,
        notes: 'Withdrawal requested by freelancer'
      });
      await transaction.save();
  
      // Fund status remains IN_REVIEW (admin will process)
      res.status(200).json({ success: true, transaction });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Withdrawal request failed',
        error: error.message 
      });
    }
  };
  
  // Admin processes withdrawal
  export const processWithdrawal = async (req, res) => {
    try {
      const { transactionId, action } = req.body; // action: 'approve', 'reject', 'delay'
      const transaction = await Transaction.findById(transactionId).populate('fund_id');
      
      if (!transaction || transaction.type !== TRANSACTION_TYPE.RELEASE) {
        return res.status(404).json({ 
          success: false, 
          message: 'Withdrawal transaction not found' 
        });
      }
  
      const fund = transaction.fund_id;
      const escrowAccount = await EscrowAccount.findOne({ client_id: fund.client_id });
  
      switch (action) {
        case 'approve':
          // Deduct from escrow
          escrowAccount.deductFunds(transaction.amount);
          await escrowAccount.save();
          
          // Update transaction
          transaction.status = TRANSACTION_STATUS.COMPLETED;
          await transaction.save();
          
          // Update fund status
          fund.status = FUND_STATUS.RELEASED;
          await fund.save();
          
          // Payout to freelancer (using your existing Stripe logic)
          const freelancer = await User.findById(fund.freelancer_id);
          const payout = await stripe.payouts.create({
            amount: Math.round(transaction.amount * 100),
            currency: fund.currency,
            method: 'instant',
            destination: freelancer.stripeAccountId
          });
          break;
  
        case 'delay':
          // Set 5-day delay
          const delayDays = 5;
          fund.setDelay(req.user._id, delayDays, 'Security review');
          await fund.save();
          break;
  
        case 'reject':
          transaction.status = TRANSACTION_STATUS.FAILED;
          await transaction.save();
          break;
      }
  
      res.status(200).json({ success: true, transaction, fund });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Withdrawal processing failed',
        error: error.message 
      });
    }
  };
  
  // Create dispute
  export const createDispute = async (req, res) => {
    try {
      const { fundId, initiatorId, reason, description } = req.body;
      const fund = await Fund.findById(fundId);
      
      if (!fund) {
        return res.status(404).json({ success: false, message: 'Fund not found' });
      }
  
      const respondentId = initiatorId === fund.client_id.toString() 
        ? fund.freelancer_id 
        : fund.client_id;
  
      const dispute = new Dispute({
        fund_id: fundId,
        initiator_id: initiatorId,
        respondent_id: respondentId,
        status: DISPUTE_STATUS.OPEN,
        reason,
        description
      });
      await dispute.save();
  
      // Update fund status
      fund.status = FUND_STATUS.IN_DISPUTE;
      await fund.save();
  
      res.status(201).json({ success: true, dispute });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Dispute creation failed',
        error: error.message 
      });
    }
  };
  
  // Admin resolves dispute
  export const resolveDispute = async (req, res) => {
    try {
      const { disputeId, resolution } = req.body; // resolution: { type, amountClient, amountFreelancer }
      const dispute = await Dispute.findById(disputeId);
      const fund = await Fund.findById(dispute.fund_id);
      const escrowAccount = await EscrowAccount.findOne({ client_id: fund.client_id });
  
      // Apply resolution
      dispute.resolve(
        resolution.type,
        resolution.amountClient,
        resolution.amountFreelancer,
        resolution.notes
      );
      await dispute.save();
  
      // Create resolution transactions
      if (resolution.amountFreelancer > 0) {
        const freelancerTx = new Transaction({
          fund_id: fund._id,
          type: TRANSACTION_TYPE.RELEASE,
          amount: resolution.amountFreelancer,
          currency: fund.currency,
          initiated_by: req.user._id, // admin
          status: TRANSACTION_STATUS.COMPLETED,
          notes: `Dispute resolution payout to freelancer`
        });
        await freelancerTx.save();
        
        // Deduct from escrow
        escrowAccount.deductFunds(resolution.amountFreelancer);
      }
  
      if (resolution.amountClient > 0) {
        const clientTx = new Transaction({
          fund_id: fund._id,
          type: TRANSACTION_TYPE.REFUND,
          amount: resolution.amountClient,
          currency: fund.currency,
          initiated_by: req.user._id, // admin
          status: TRANSACTION_STATUS.COMPLETED,
          notes: `Dispute resolution refund to client`
        });
        await clientTx.save();
        
        // Refund to client (using Stripe)
        const client = await User.findById(fund.client_id);
        await stripe.refunds.create({
          payment_intent: fund.paymentIntentId,
          amount: Math.round(resolution.amountClient * 100)
        });
      }
  
      // Update escrow and fund
      await escrowAccount.save();
      fund.status = FUND_STATUS.RELEASED;
      await fund.save();
  
      res.status(200).json({ success: true, dispute });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Dispute resolution failed',
        error: error.message 
      });
    }
  };