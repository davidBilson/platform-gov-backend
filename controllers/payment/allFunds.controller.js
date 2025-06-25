import Transactions from '../../models/transactions.model.js';
import User from '../../models/user.model.js';
import Job from '../../models/job.created.model.js';
import Stripe from 'stripe';
import { Fund, Transaction as EscrowTransaction, FUND_STATUS } from '../../models/escrow.model.js';
import Contract from '../../models/contract.model.js';

import { createEscrowForFundedProject } from './escrow.controller.js';
import mongoose from 'mongoose';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_51RZUzrQpiUcmNrzkun1iqWcxZjk6cZXYc5AtPPznpa9D8vNxzLTVZp836xHyzCnbt7Jl7Qes97bv0TlXMnAO29mU00fuaY1StL';

if (!STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is not defined in environment variables');
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

export const stripe = new Stripe(STRIPE_SECRET_KEY);

//******************************************************/
// <START CONTROLLERS WORKING WITH LIVE FUNDS INTEGRATED WITH STRIPE START/>
//******************************************************/
export const fundProject = async (req, res) => {
    try {
        const { jobId, userId } = req.body;

        if (!jobId) {
            return res.status(400).json({
                success: false,
                message: 'Job ID is required'
            });
        }

        const user = await User.findById(userId);
        const job = await Job.findById(jobId);

        if (!user || !job) {
            return res.status(404).json({
                success: false,
                message: 'User or Job not found'
            });
        }

        if (job.userId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to fund this project'
            });
        }

        if (job.status !== 'open' || job.isFunded) {
            return res.status(200).json({
                success: false,
                message: 'Job has already been funded!'
            });
        }

        // Calculate amounts
        let amount = 0;
        let description = '';

        switch (job.paymentType) {
            case 'fixed-price':
                amount = job.price;
                description = `Fixed price payment for job: ${job.jobTitle}`;
                break;
            case 'retainer':
                amount = job.retainerAmount;
                description = `Retainer payment (${job.retainerFrequency}) for job: ${job.jobTitle}`;
                break;
            case 'hourly':
                amount = job.price * 10;
                description = `Initial hourly payment (10hrs) for job: ${job.jobTitle}`;
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid payment type'
                });
        }

        const platformFee = Math.round(amount * 0.05 * 100) / 100;
        const totalAmount = amount + platformFee;

        if (!user.stripeCustomerId || !user.defaultPaymentMethod) {
            console.log(`User ${userId} does not have a Stripe customer ID or default payment method`);
            return res.status(400).json({
                success: false,
                message: 'Payment method not set up'
            });
        }

        // Create PaymentIntent with idempotency key
        const idempotencyKey = `fund-${jobId}-${Date.now()}`;
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(totalAmount * 100),
            currency: 'usd',
            customer: user.stripeCustomerId,
            payment_method: user.defaultPaymentMethod,
            off_session: true,
            confirm: true,
            description,
            metadata: {
                jobId: job._id.toString(),
                userId: user._id.toString(),
                project: job.jobTitle
            },
            transfer_group: `JOB_${job._id}`,
        }, {
            idempotencyKey
        });

        // Handle authentication requirements
        if (paymentIntent.status === 'requires_action') {
            console.log(`Payment requires authentication for job ${jobId}`);
            return res.status(200).json({
                success: false,
                requires_action: true,
                client_secret: paymentIntent.client_secret,
                message: 'Payment requires authentication'
            });
        }

        if (paymentIntent.status !== 'succeeded') {
            console.log(`Payment failed for job ${jobId}: status=${paymentIntent.status}`);
            return res.status(400).json({
                success: false,
                message: `Payment failed: ${paymentIntent.status}`
            });
        }

        // Update job
        job.isFunded = true;
        job.paymentIntentId = paymentIntent.id;
        await job.save();

        // Create transaction
        const transaction = await Transactions.create({
            userId,
            jobId: job._id,
            type: 'project_funding',
            amount: totalAmount,
            fee: platformFee,
            status: 'completed',
            paymentMethod: 'card',
            stripePaymentIntentId: paymentIntent.id,
            netAmount: amount,
            description
        });

        try {
            await createEscrowForFundedProject(jobId, userId)
        } catch (error) {
            console.error('Escrow creation failed:', error);
        }

        res.status(200).json({
            success: true,
            message: 'Project funded successfully',
            transactionId: transaction._id,
            amount: totalAmount
        });

    } catch (error) {
        console.error('Error funding project:', error);

        // Handle Stripe errors
        if (error.type === 'StripeCardError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        if (error.code === 'authentication_required') {
            return res.status(400).json({
                success: false,
                requires_action: true,
                payment_intent_id: error.payment_intent.id,
                message: 'Authentication required'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

export const releaseFunds = async (req, res) => {
    try {
        const { contractId, userId } = req.body;
        console.log('Release funds request body: ', contractId, userId)
        const contract = await Contract.findById(contractId)
            .populate('jobId')
            .populate('contractorId', 'stripeAccountId');

        if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });
        if (contract.clientId.toString() !== userId.toString()) {
            console.log('Only contract client can release funds')
            return res.status(403).json({ success: false, message: 'Only contract client can release funds' });
        }
        if (contract.status !== 'completed') {
            console.log('Contract must be completed to release funds')
            return res.status(400).json({ success: false, message: 'Contract must be completed to release funds' });
        }

        const fund = await Fund.findOne({ job_id: contract.jobId._id });
        if (!fund) return res.status(404).json({ success: false, message: 'Fund not found' });
        if (fund.status !== FUND_STATUS.AVAILABLE) {
            return res.status(400).json({ success: false, message: 'Funds are not available for release' });
        }
        if (contract.totalEarnings > fund.amount) return res.status(400).json({ success: false, message: "Contract earnings exceed available fund amount" });
        
        const platformFee = contract.totalEarnings * 0.05;
        const netAmount = contract.totalEarnings - platformFee;

        // Create transfer to contractor's Stripe account
        const transfer = await stripe.transfers.create({
            amount: Math.round(netAmount * 100),
            currency: 'usd',
            destination: contract.contractorId.stripeAccountId,
            metadata: {
                jobId: contract.jobId._id.toString(),
                contractId: contractId,
                clientId: userId,
                contractorId: contract.contractorId._id.toString()
            }
        });

        fund.withdrawableAmount = netAmount ?? 0;
        fund.amount = fund.amount - contract.totalEarnings; // that is how much is left after payout to contractor
        fund.status = FUND_STATUS.PENDING;
        fund.stripe_transfer_id = transfer.id;
        fund.available_after = new Date(transfer.available_on * 1000); // Convert to milliseconds
        await fund.save();

        // Create transaction record
        await Transactions.create({
            userId: contract.contractorId._id,
            jobId: contract.jobId._id,
            type: 'payout_pending',
            amount: netAmount,
            status: 'pending',
            paymentMethod: 'escrow',
            stripeTransferId: transfer.id,
            description: `Funds released - available on ${new Date(transfer.available_on * 1000).toDateString()}`
        });

        res.status(200).json({
            success: true,
            message: 'Funds released to contractor. Awaiting Stripe processing.',
            transferId: transfer.id,
            availableOn: new Date(transfer.available_on * 1000)
        });

    } catch (error) {
        console.error('Error releasing funds:', error);
        res.status(500).json({
            success: false,
            message: 'Error releasing funds',
            error: error.message
        });
    }
};

// Track payout availability (to be run periodically via cron job)
export const trackPayoutAvailability = async (req, res) => {
    try {
        const now = new Date();
        const fundsToUpdate = await Fund.find({
            status: FUND_STATUS.PENDING,
            available_after: { $lte: now }
        });

        if (fundsToUpdate.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No funds to update at this time.'
            });
        }

        const updatePromises = fundsToUpdate.map(async (fund) => {
            fund.status = FUND_STATUS.AVAILABLE;
            await fund.save();

            await Transactions.create({
                userId: fund.contractor_id,
                jobId: fund.job_id,
                type: 'payout_available',
                amount: fund.amount,
                status: 'completed',
                paymentMethod: 'escrow',
                description: `Funds now available for withdrawal`
            });
        });

        await Promise.all(updatePromises);

        res.status(200).json({
            success: true,
            message: `${fundsToUpdate.length} funds updated to available.`
        });

    } catch (error) {
        console.error('Error tracking payout availability:', error);
        res.status(500).json({
            success: false,
            message: 'Error tracking payout availability',
            error: error.message
        });
    }
};

export const getWithdrawableFunds = async (req, res) => {
    try {
        const userId = req.params.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Find all released funds for this contractor
        const funds = await Fund.find({
            contractor_id: userId,
            status: FUND_STATUS.AVAILABLE
        }).populate('job_id', 'jobTitle');

        if (!funds || funds.length === 0) {
            return res.status(200).json({
                success: true,
                totalAmount: 0,
                currency: 'USD',
                funds: [],
                message: 'No funds available for withdrawal'
            });
        }

        // Calculate total amount
        const totalAmount = funds.reduce((sum, fund) => sum + fund.withdrawableAmount, 0);

        // Format response
        const formattedFunds = funds.map(fund => ({
            fundId: fund._id.toString(),
            jobId: fund.job_id._id.toString(),
            jobTitle: fund.job_id.jobTitle || 'Untitled Job',
            amount: Number(fund.withdrawableAmount),
            currency: fund.currency || 'USD',
            releasedAt: fund.released_at || fund.updatedAt
        }));

        res.status(200).json({
            success: true,
            totalAmount: Number(totalAmount.toFixed(2)),
            currency: 'USD',
            funds: formattedFunds,
            message: `${funds.length} payment${funds.length > 1 ? 's' : ''} available for withdrawal`
        });

    } catch (error) {
        console.error('Error fetching withdrawable funds:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching withdrawable funds',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const getContractorFunds = async (req, res) => {
    try {
      const contractorId = req.params.id;
      
      const funds = await Fund.find({ contractor_id: contractorId })
        .populate('job_id', 'jobTitle')
        .populate('client_id', 'name');
  
      const categorizedFunds = {
        available: [],
        in_review: [],
        pending: [],
        withdrawn: []
      };
  
      funds.forEach(fund => {
        const fundData = {
          id: fund._id,
          jobId: fund.job_id._id,
          jobTitle: fund.job_id.jobTitle,
          clientName: fund.client_id.name,
          amount: fund.withdrawableAmount,
          createdAt: fund.created_at,
          availableAfter: fund.available_after,
          withdrawnAt: fund.withdrawn_at
        };
  
        switch(fund.status) {
          case FUND_STATUS.AVAILABLE:
            categorizedFunds.available.push(fundData);
            break;
          case FUND_STATUS.IN_REVIEW:
            categorizedFunds.in_review.push(fundData);
            break;
          case FUND_STATUS.PENDING:
            categorizedFunds.pending.push(fundData);
            break;
          case FUND_STATUS.WITHDRAWN:
            categorizedFunds.withdrawn.push(fundData);
            break;
        }
      });
  
      res.status(200).json({ success: true, funds: categorizedFunds });
    } catch (error) {
      console.error('Error getting contractor funds:', error);
      res.status(500).json({ success: false, message: 'Error retrieving funds' });
    }
  };
  
  export const getClientFunds = async (req, res) => {
    try {
      const clientId = req.params.id;
      
      const funds = await Fund.find({ client_id: clientId })
        .populate('job_id', 'jobTitle')
        .populate('contractor_id', 'name');
  
      const categorizedFunds = {
        in_escrow: [],
        released: []
      };
  
      funds.forEach(fund => {
        const fundData = {
          id: fund._id,
          jobId: fund.job_id._id,
          jobTitle: fund.job_id.jobTitle,
          contractorName: fund.contractor_id?.name || 'Unknown',
          amount: fund.amount,
          createdAt: fund.created_at,
          releasedAt: fund.released_at
        };
  
        // For client: in_escrow = funds still in escrow or in review
        if ([FUND_STATUS.IN_ESCROW, FUND_STATUS.IN_REVIEW].includes(fund.status)) {
          categorizedFunds.in_escrow.push(fundData);
        } 
        // For client: released = funds that have been released (pending/available/withdrawn)
        else if ([FUND_STATUS.PENDING, FUND_STATUS.AVAILABLE, FUND_STATUS.WITHDRAWN].includes(fund.status)) {
          categorizedFunds.released.push(fundData);
        }
      });
  
      res.status(200).json({ success: true, funds: categorizedFunds });
    } catch (error) {
      console.error('Error getting client funds:', error);
      res.status(500).json({ success: false, message: 'Error retrieving funds' });
    }
  };

export const withdrawFunds = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { fundId } = req.query;
        const userId = req.params.id;

        if (!fundId) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: 'Fund ID is required' });
        }

        const fund = await Fund.findOne({
            _id: fundId,
            contractor_id: userId,
            status: FUND_STATUS.AVAILABLE
        }).populate('job_id', 'jobTitle').session(session);

        if (!fund) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: 'Fund not available for withdrawal' });
        }

        const contractor = await User.findById(userId).session(session);
        if (!contractor) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: 'Contractor not found' });
        }

        // Check if contractor has connected bank account
        if (!contractor.bankAccounts || contractor.bankAccounts.length === 0) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'No bank account found. Please add a bank account first.'
            });
        }

        // Retrieve Stripe balance
        const balance = await stripe.balance.retrieve({
            stripeAccount: contractor.stripeAccountId
        });

        // Find USD available balance
        const usdBalance = balance.available.find(b => b.currency === 'usd');
        const availableBalance = usdBalance ? usdBalance.amount / 100 : 0;

        // Check if balance meets minimum requirement
        if (availableBalance < 50) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: `Insufficient balance for withdrawal. Minimum required: $50. Available: $${availableBalance}`
            });
        }

        const defaultBankAccount = contractor.bankAccounts.find(acc => acc.isDefault) || contractor.bankAccounts[0];
        const amountInCents = Math.round(fund.withdrawableAmount * 100);

        // Create payout
        const payout = await stripe.payouts.create({
            amount: amountInCents,
            currency: 'usd',
            destination: defaultBankAccount.id,
            metadata: { fundId: fundId }
        }, { stripeAccount: contractor.stripeAccountId });

        // Update fund status
        fund.status = FUND_STATUS.WITHDRAWN;
        fund.stripe_payout_id = payout.id;
        fund.withdrawn_at = new Date();
        await fund.save({ session });

        // Create transaction record
        const transaction = await Transactions.create([{
            userId: userId,
            jobId: fund.job_id._id,
            type: 'payout',
            amount: fund.withdrawableAmount,
            status: 'completed',
            paymentMethod: 'bank_account',
            stripePayoutId: payout.id,
            description: `Withdrawal for job: ${fund.job_id.jobTitle}`,
            createdAt: new Date()
        }], { session });

        await session.commitTransaction();

        res.status(200).json({
            success: true,
            message: 'Funds withdrawn successfully',
            payoutId: payout.id,
            amount: fund.withdrawableAmount,
            estimatedArrival: new Date(payout.arrival_date * 1000),
            transactionId: transaction[0]._id
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Withdrawal failed:', error);

        let userMessage = 'Withdrawal failed. Please try again.';
        if (error.type === 'StripeInvalidRequestError') {
            userMessage = error.message;
        } else if (error.code === 'insufficient_funds') {
            userMessage = 'Insufficient funds in your Stripe account.';
        }

        res.status(400).json({
            success: false,
            message: userMessage,
            error: error.message
        });
    } finally {
        await session.endSession();
    }
};

//******************************************************/ 
// <END CONTROLLERS WORKING WITH LIVE FUNDS INTEGRATED WITH STRIPE END/>
//******************************************************/ 