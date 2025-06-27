import Withdrawal from '../../models/withdrawal.model.js';
import Transactions from '../../models/transactions.model.js';
import User from '../../models/user.model.js';
import Job from '../../models/job.created.model.js';
import Stripe from 'stripe';
import { Fund, Transaction as EscrowTransaction, FUND_STATUS } from '../../models/escrow.model.js';
import Contract from '../../models/contract.model.js';
import cron from 'node-cron';

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

        if (job.isFunded) {
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
            await createEscrowForFundedProject(jobId, userId, amount);
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
        const { contractId, userId, amount: releaseAmount } = req.body;
        console.log('Release funds request:', { contractId, userId, releaseAmount });
        
        const contract = await Contract.findById(contractId)
            .populate('jobId')
            .populate('contractorId', 'stripeAccountId');

        if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });
        if (contract.clientId.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Only contract client can release funds' });
        }
        if (contract.status !== 'completed') {
            return res.status(400).json({ success: false, message: 'Contract must be completed to release funds' });
        }

        const fund = await Fund.findOne({ jobId: contract.jobId._id });
        if (!fund) return res.status(404).json({ success: false, message: 'Fund not found' });
        
        // Determine release amount - use provided amount or total contract earnings
        const amountToRelease = releaseAmount || contract.totalEarnings;
        
        if (fund.in_escrow.amount < amountToRelease) {
            return res.status(400).json({ 
                success: false, 
                message: 'Insufficient funds in escrow for this release' 
            });
        }
        
        const platformFee = amountToRelease * 0.05;
        const netAmount = amountToRelease - platformFee;

        // Create transfer to contractor's Stripe account
        const transfer = await stripe.transfers.create({
            amount: Math.round(netAmount * 100),
            currency: 'usd',
            destination: contract.contractorId.stripeAccountId,
            metadata: {
                jobId: contract.jobId._id.toString(),
                contractId: contractId,
                clientId: userId,
                contractorId: contract.contractorId._id.toString(),
                releaseAmount: amountToRelease.toString()
            }
        });

        // Validate and set available_after date
        let availableAfterDate;
        if (transfer.available_on && typeof transfer.available_on === 'number') {
            availableAfterDate = new Date(transfer.available_on * 1000);
            if (isNaN(availableAfterDate.getTime())) {
                console.warn('Invalid available_on timestamp from Stripe:', transfer.available_on);
                availableAfterDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
            }
        } else {
            console.warn('No available_on field in Stripe transfer response, using default');
            availableAfterDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
        }

        // Update fund using new schema methods
        fund.releaseFromEscrow(amountToRelease);
        fund.stripe_transfer_id = transfer.id;
        fund.available_after = availableAfterDate;
        fund.contractorId = contract.contractorId._id;
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
            description: `Funds released - available on ${availableAfterDate.toDateString()}`
        });
        
        console.log('Funds released to contractor, awaiting stripe processing');
        res.status(200).json({
            success: true,
            message: 'Funds released to contractor. Awaiting Stripe processing.',
            transferId: transfer.id,
            availableOn: availableAfterDate,
            amountReleased: amountToRelease,
            netAmount: netAmount
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


// Extract the core logic into a separate function
const processPayoutAvailability = async () => {
    const now = new Date();
    const fundsToUpdate = await Fund.find({
        'pending.amount': { $gt: 0 },
        available_after: { $lte: now }
    });

    if (fundsToUpdate.length === 0) {
        return {
            success: true,
            message: 'No funds to update at this time.',
            count: 0
        };
    }

    const updatePromises = fundsToUpdate.map(async (fund) => {
        const pendingAmount = fund.pending.amount;
        fund.makePendingAvailable(pendingAmount);
        await fund.save();

        await Transactions.create({
            userId: fund.contractorId,
            jobId: fund.jobId,
            type: 'payout_available',
            amount: pendingAmount,
            status: 'completed',
            paymentMethod: 'escrow',
            description: `Funds now available for withdrawal`
        });
    });

    await Promise.all(updatePromises);

    console.log('funds updated to available');
    return {
        success: true,
        message: `${fundsToUpdate.length} funds updated to available.`,
        count: fundsToUpdate.length
    };
};

// Express route handler
export const trackPayoutAvailability = async (req, res) => {
    try {
        const result = await processPayoutAvailability();
        res.status(200).json(result);
    } catch (error) {
        console.error('Error tracking payout availability:', error);
        res.status(500).json({
            success: false,
            message: 'Error tracking payout availability',
            error: error.message
        });
    }
};

// Cron job - now calls the extracted function
cron.schedule('0 * * * *', async () => {
    try {
        const result = await processPayoutAvailability();
        console.log(`Cron job completed: ${result.message}`);
    } catch (error) {
        console.error('Cron job failed:', error);
    }
});

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

        // Find all funds with available amounts for this contractor
        const funds = await Fund.find({
            contractorId: userId,
            'available.amount': { $gt: 0 }
        }).populate('jobId', 'jobTitle');

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
        const totalAmount = funds.reduce((sum, fund) => sum + fund.available.amount, 0);

        // Format response
        const formattedFunds = funds.map(fund => ({
            fundId: fund._id.toString(),
            jobId: fund.jobId._id.toString(),
            jobTitle: fund.jobId.jobTitle || 'Untitled Job',
            amount: Number(fund.available.amount),
            currency: fund.currency || 'USD',
            availableAt: fund.available.date
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

        if (!mongoose.Types.ObjectId.isValid(contractorId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid contractor ID format' 
            });
        }

        const contractorObjectId = new mongoose.Types.ObjectId(contractorId);
        
        const contractor = await User.findById(contractorObjectId);
        
        if (!contractor) {
            return res.status(404).json({ 
                success: false, 
                message: 'Contractor not found' 
            });
        }

        let stripeBalance = null;
        
        if (contractor.stripeAccountId) {
            try {
                
                const balance = await stripe.balance.retrieve({
                    stripeAccount: contractor.stripeAccountId
                });
                
                stripeBalance = {
                    available: balance.available,
                    pending: balance.pending,
                    connect_reserved: balance.connect_reserved || [],
                    instant_available: balance.instant_available || []
                };
                
                // Log totals in a more readable format
                const availableTotal = balance.available.reduce((sum, bal) => sum + bal.amount, 0);
                const pendingTotal = balance.pending.reduce((sum, bal) => sum + bal.amount, 0);
                
                console.log(`Stripe Available Total: ${availableTotal / 100} ${balance.available[0]?.currency || 'USD'}`);
                console.log(`Stripe Pending Total: ${pendingTotal / 100} ${balance.pending[0]?.currency || 'USD'}`);
                
            } catch (stripeError) {
                console.error('Error retrieving Stripe balance:', stripeError.message);
                // Don't fail the entire request if Stripe balance check fails
                stripeBalance = { error: stripeError.message };
            }
        } else {
            console.log('No Stripe account ID found for contractor');
        }

        // Query funds with proper error handling
        const funds = await Fund.find({ contractorId: contractorObjectId })
            .populate('jobId', 'jobTitle title')
            .populate('clientId', 'name firstName lastName')
            .lean();

        const categorizedFunds = {
            available: [],
            pending: [],
            disputed: [], // shown as "in review" on frontend
            withdrawn: []
        };

        funds.forEach(fund => {
            const jobTitle = fund.jobId?.jobTitle || fund.jobId?.title || 'Unknown Job';
            const clientName = fund.clientId?.name || 
                             `${fund.clientId?.firstName || ''} ${fund.clientId?.lastName || ''}`.trim() || 
                             'Unknown Client';

            const baseFundData = {
                id: fund._id,
                jobId: fund.jobId?._id || fund.jobId,
                jobTitle: jobTitle,
                clientName: clientName,
                createdAt: fund.created_at || fund.createdAt
            };

            if (fund.available && fund.available.amount > 0) {
                categorizedFunds.available.push({
                    ...baseFundData,
                    amount: fund.available.amount,
                    availableDate: fund.available.date
                });
            }

            if (fund.pending && fund.pending.amount > 0) {
                categorizedFunds.pending.push({
                    ...baseFundData,
                    amount: fund.pending.amount,
                    pendingDate: fund.pending.date,
                    availableAfter: fund.available_after
                });
            }

            if (fund.disputed && fund.disputed.amount > 0) {
                categorizedFunds.disputed.push({
                    ...baseFundData,
                    amount: fund.disputed.amount,
                    disputedDate: fund.disputed.date
                });
            }
        });

        const totals = {
            available: categorizedFunds.available.reduce((sum, f) => sum + f.amount, 0),
            pending: categorizedFunds.pending.reduce((sum, f) => sum + f.amount, 0),
            disputed: categorizedFunds.disputed.reduce((sum, f) => sum + f.amount, 0)
        };

        res.status(200).json({ 
            success: true, 
            funds: categorizedFunds,
            totals: totals, // Include totals for debugging
            totalFunds: funds.length,
            stripeBalance: stripeBalance // Include Stripe balance in response
        });
        
    } catch (error) {
        console.error('Error getting contractor funds:', error);
        console.error('Error stack:', error.stack);
        
        res.status(500).json({ 
            success: false, 
            message: 'Error retrieving funds',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
  
export const getClientFunds = async (req, res) => {
    try {
      const clientId = req.params.id;
      
      const funds = await Fund.find({ clientId: clientId })
        .populate('jobId', 'jobTitle')
        .populate('contractorId', 'name');

      const categorizedFunds = {
        in_escrow: [],
        released: [],
        disputed: []
      };

      funds.forEach(fund => {
        const baseFundData = {
          id: fund._id,
          jobId: fund.jobId._id,
          jobTitle: fund.jobId.jobTitle,
          contractorName: fund.contractorId?.name || 'Unknown',
          createdAt: fund.created_at
        };

        // Funds still in escrow
        if (fund.in_escrow.amount > 0) {
          categorizedFunds.in_escrow.push({
            ...baseFundData,
            amount: fund.in_escrow.amount,
            escrowDate: fund.in_escrow.date
          });
        }

        // Released funds
        if (fund.released.amount > 0) {
          categorizedFunds.released.push({
            ...baseFundData,
            amount: fund.released.amount,
            releasedDate: fund.released.date
          });
        }

        // Disputed funds
        if (fund.disputed.amount > 0) {
          categorizedFunds.disputed.push({
            ...baseFundData,
            amount: fund.disputed.amount,
            disputedDate: fund.disputed.date
          });
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
    const userId = req.params.id;
    const amount = parseFloat(req.query.amount);

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid withdrawal amount' 
      });
    }

    // 1. Check total available funds
    const totalFunds = await Fund.aggregate([
      { $match: { contractorId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, total: { $sum: "$available.amount" } } }
    ]).session(session);

    const availableBalance = totalFunds[0]?.total || 0;
    
    if (availableBalance < amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient funds' 
      });
    }

    // 2. Check Stripe balance
    const user = await User.findById(userId).session(session);
    if (!user.stripeAccountId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Stripe account not set up' 
      });
    }

    const balance = await stripe.balance.retrieve({
      stripeAccount: user.stripeAccountId
    });
    
    const stripeBalance = balance.available.reduce(
      (sum, bal) => bal.currency === 'usd' ? sum + bal.amount : sum, 0
    ) / 100;

    if (stripeBalance < amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient Stripe balance' 
      });
    }

    // 3. Find bank account
    const bankAccount = user.bankAccounts.find(acc => acc.isDefault) || user.bankAccounts[0];
    if (!bankAccount) {
      return res.status(400).json({ 
        success: false, 
        message: 'No bank account found' 
      });
    }

    // 4. Create payout
    const payout = await stripe.payouts.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      destination: bankAccount.id,
      metadata: { userId }
    }, { stripeAccount: user.stripeAccountId });

    // 5. Deduct funds from available balance (oldest first)
    const funds = await Fund.find({
      contractorId: userId,
      "available.amount": { $gt: 0 }
    })
    .sort({ "available.date": 1 })
    .session(session);

    let remaining = amount;
    for (const fund of funds) {
      if (remaining <= 0) break;
      
      const deductAmount = Math.min(remaining, fund.available.amount);
      fund.available.amount -= deductAmount;
      remaining = parseFloat((remaining - deductAmount).toFixed(2));
      
      await fund.save({ session });
    }

    // 6. Record withdrawal
    const withdrawal = new Withdrawal({
      userId,
      amount,
      payoutId: payout.id,
      bankAccount: {
        id: bankAccount.id,
        bankName: bankAccount.bankName,
        last4: bankAccount.last4
      },
      status: 'completed'
    });
    
    await withdrawal.save({ session });

    // 7. Record transaction
    const transaction = new Transactions({
      userId,
      type: 'withdrawal',
      amount: -amount,
      status: 'completed',
      paymentMethod: 'bank_account',
      stripePayoutId: payout.id,
      description: `Withdrawal to ${bankAccount.bankName} ****${bankAccount.last4}`
    });
    
    await transaction.save({ session });

    await session.commitTransaction();
    
    res.status(200).json({
      success: true,
      amount,
      payoutId: payout.id,
      estimatedArrival: new Date(payout.arrival_date * 1000)
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Withdrawal failed'
    });
  } finally {
    session.endSession();
  }
};

//******************************************************/ 
// <END CONTROLLERS WORKING WITH LIVE FUNDS INTEGRATED WITH STRIPE END/>
//******************************************************/ 