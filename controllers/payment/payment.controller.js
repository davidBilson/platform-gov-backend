import Transactions from '../../models/transactions.model.js';
import User from '../../models/user.model.js';
import Job from '../../models/job.created.model.js';
import PlatformFees from '../../models/platform.fees.model.js';
import Stripe from 'stripe';
import { Fund, Transaction as EscrowTransaction, EscrowAccount, TRANSACTION_STATUS, FUND_STATUS } from '../../models/escrow.model.js';
import Contract from '../../models/contract.model.js';

import { createEscrowForFundedProject } from './escrow.controller.js';
import Transaction from '../../models/transactions.model.js';
import mongoose from 'mongoose';

const STRIPE_SECRET_KEY = process?.env?.STRIPE_SECRET_KEY || 'sk_test_51RZUzrQpiUcmNrzkun1iqWcxZjk6cZXYc5AtPPznpa9D8vNxzLTVZp836xHyzCnbt7Jl7Qes97bv0TlXMnAO29mU00fuaY1StL';

if (!STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not defined in environment variables');
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

export const stripe = new Stripe(STRIPE_SECRET_KEY);



export const getTransactionHistory = async (req, res) => {
  try {
    const userId = req.params.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const transactions = await Transactions.find({ userId })
      .populate('jobId', 'title description budget')
      .sort({ createdAt: -1 });

    const formattedTransactions = transactions.map(transaction => ({
      id: transaction._id,
      type: transaction.type,
      description: transaction.description,
      jobTitle: transaction.jobId?.title || null,
      jobId: transaction.jobId?._id || null,
      amount: transaction.amount,
      fee: transaction.fee,
      netAmount: transaction.netAmount || (transaction.amount - transaction.fee),
      currency: transaction.currency,
      status: transaction.status,
      paymentMethod: transaction.paymentMethod,
      stripePaymentIntentId: transaction.stripePaymentIntentId,
      stripeChargeId: transaction.stripeChargeId,
      stripeCustomerId: transaction.stripeCustomerId,
      stripePayoutId: transaction.stripePayoutId,
      metadata: transaction.metadata,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt
    }));

    // Calculate summary data
    const summary = {
      totalReceived: 0,
      totalWithdrawn: 0,
      totalRefunds: 0,
      totalDisputes: 0
    };

    transactions.forEach(transaction => {
      // Calculate based on transaction type and status
      if (transaction.status === 'completed') {
        switch (transaction.type) {
          case 'project_funding':
            summary.totalReceived += transaction.amount || 0;
            break;
          case 'payout':
            summary.totalWithdrawn += transaction.amount || 0;
            break;
          case 'refund':
            summary.totalRefunds += transaction.amount || 0;
            break;
          case 'dispute':
            summary.totalDisputes += transaction.amount || 0;
            break;
          // payment_method_added typically has amount: 0, so we can skip it
          // or handle it separately if needed
          case 'payment_method_added':
            // This usually doesn't affect financial totals
            break;
        }
      }
    });

    res.status(200).json({
      success: true,
      data: {
        transactions: formattedTransactions,
        summary: summary
      },
      message: 'Transaction history retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({
      success: false,
      data: {
        transactions: [],
        summary: {
          totalReceived: 0,
          totalWithdrawn: 0,
          totalRefunds: 0,
          totalDisputes: 0
        }
      },
      message: 'Error fetching transaction history',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

export const getPlatformFee = async (req, res) => {
  try {
    const platformFees = await PlatformFees.getSettings();

    return res.status(200).json({
      success: true,
      data: {
        freelancerFee: platformFees.freelancerServiceFee,
        clientFee: platformFees.clientServiceFee
      }
    });
  } catch (error) {
    console.error('Error fetching platform fees:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch platform fees',
      error: error.message
    });
  }
};

export const getUserPaymentMethods = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.stripeCustomerId) {
      return res.status(200).json({
        success: true,
        paymentMethods: [],
        message: 'No payment methods found'
      });
    }

    // Get payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: 'card',
    });

    // Format payment methods for response
    const formattedPaymentMethods = paymentMethods.data.map(pm => ({
      id: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
      isDefault: pm.id === user.defaultPaymentMethod
    }));

    res.status(200).json({
      success: true,
      paymentMethods: formattedPaymentMethods,
      defaultPaymentMethod: user.defaultPaymentMethod
    });

  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment methods',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

export const getPayoutMethods = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const payoutMethods = (user.bankAccounts || []).map(account => ({
      id: account.id || account._id,
      type: 'bank',
      bankName: account.bankName,
      last4: account.last4,
      isPrimary: account.$isDefault || account.default,
      country: account.country,
      currency: account.currency
    }));

    res.status(200).json({
      success: true,
      payoutMethods
    });

  } catch (error) {
    res.status(500).json({ success: false, payoutMethods: [] });
  }
};

export const getPendingPayouts = async (req, res) => {
  try {

    const adminId = req.params.id;

    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: 'Admin ID is required'
      });
    }

    const pendingFunds = await Fund.find({
      status: 'pending_review'
    })
      .populate({
        path: 'client_id',
        select: 'name email phoneNumber role'
      })
      .populate({
        path: 'contractor_id',
        select: 'name email phoneNumber stripeCustomerId stripeAccountId bankAccounts role'
      })
      .populate({
        path: 'job_id',
        select: '_id jobTitle description price paymentType location clientName status createdAt'
      })
      .sort({ created_at: -1 });


    if (!pendingFunds || pendingFunds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No pending payouts found',
        data: [],
        count: 0
      });
    }

    const payoutsWithContractDetails = await Promise.all(
      pendingFunds.map(async (fund) => {

        try {

          const contract = await Contract.findOne({
            jobId: fund.job_id._id
          })
            .populate({
              path: 'contractorId',
              select: 'name email bankAccounts stripeAccountId'
            })
            .populate({
              path: 'clientId',
              select: 'name email'
            })
            .select('hiringId startDate status paymentStructure milestones timesheets retainer createdAt updatedAt');

          const escrowAccount = await EscrowAccount.findOne({
            client_id: fund.client_id._id
          }).select('balance currency frozen total_funded total_released');

          const transactions = await Transaction.find({
            fund_id: fund._id
          })
            .sort({ timestamp: -1 })
            .limit(5);

          const fundAge = Math.floor((new Date() - fund.created_at) / (1000 * 60 * 60 * 24)); // days
          const isOverdue = fund.due_date && fund.due_date < new Date();
          const canRelease = fund.canRelease ? fund.canRelease() : true;
          return {
            fundId: fund._id,
            amount: fund.amount,
            currency: fund.currency,
            status: fund.status,
            dueDate: fund.due_date,
            createdAt: fund.created_at,
            updatedAt: fund.updated_at,
            milestoneTitle: fund.milestone_title,
            milestoneDescription: fund.milestone_description,
            workSubmittedAt: fund.work_submitted_at,
            reviewRequestedAt: fund.review_requested_at,
            adminNotes: fund.admin_notes,

            // Calculated fields
            fundAgeInDays: fundAge,
            isOverdue: isOverdue,
            canRelease: canRelease,
            isDelayed: fund.is_delayed,
            delayUntil: fund.delay_until,
            delayReason: fund.delay_reason,

            job: {
              id: fund.job_id._id,
              title: fund.job_id.jobTitle,
              description: fund.job_id.description,
              price: fund.job_id.price,
              paymentType: fund.job_id.paymentType,
              location: fund.job_id.location,
              clientName: fund.job_id.clientName,
              status: fund.job_id.status,
              createdAt: fund.job_id.createdAt
            },

            client: {
              id: fund.client_id._id,
              name: fund.client_id.name,
              email: fund.client_id.email,
              phoneNumber: fund.client_id.phoneNumber,
              role: fund.client_id.role,
              stripeCustomerId: fund.client_id.stripeCustomerId,
            },

            contractor: {
              id: fund.contractor_id._id,
              name: fund.contractor_id.name,
              email: fund.contractor_id.email,
              phoneNumber: fund.contractor_id.phoneNumber,
              role: fund.contractor_id.role,
              stripeAccountId: fund.contractor_id.stripeAccountId,
              bankAccounts: fund.contractor_id.bankAccounts,
              // This is crucial for payout processing
              canReceivePayout: !!fund.contractor_id.stripeAccountId &&
                fund.contractor_id.bankAccounts &&
                fund.contractor_id.bankAccounts.length > 0
            },

            contract: contract ? {
              id: contract._id,
              hiringId: contract.hiringId,
              startDate: contract.startDate,
              status: contract.status,
              paymentStructure: contract.paymentStructure,
              milestonesCount: contract.milestones ? contract.milestones.length : 0,
              completedMilestones: contract.milestones ?
                contract.milestones.filter(m => m.status === 'completed').length : 0,
              timesheetsCount: contract.timesheets ? contract.timesheets.length : 0,
              hasRetainer: !!contract.retainer,
              createdAt: contract.createdAt
            } : null,

            escrowAccount: escrowAccount ? {
              balance: escrowAccount.balance,
              currency: escrowAccount.currency,
              frozen: escrowAccount.frozen,
              totalFunded: escrowAccount.total_funded,
              totalReleased: escrowAccount.total_released,
              hasSufficientFunds: escrowAccount.balance >= fund.amount
            } : null,

            recentTransactions: transactions.map(t => ({
              id: t._id,
              type: t.type,
              amount: t.amount,
              status: t.status,
              timestamp: t.timestamp,
              notes: t.notes
            }))
          };
        } catch (error) {
          console.error(`Error processing fund ${fund._id}:`, error);
          // Return basic fund info if detailed processing fails
          return {
            fundId: fund._id,
            amount: fund.amount,
            currency: fund.currency,
            status: fund.status,
            error: 'Failed to load complete details',
            client: fund.client_id,
            contractor: fund.contractor_id,
            job: fund.job_id
          };
        }
      })
    );


    console.log('payoutsWithContractDetails: : : ', payoutsWithContractDetails)
    // Filter out any null results and sort by priority
    const validPayouts = payoutsWithContractDetails
      .filter(payout => payout)
      .sort((a, b) => {
        // Sort by overdue first, then by age
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        return b.fundAgeInDays - a.fundAgeInDays;
      });

    // Calculate summary statistics
    const summary = {
      totalPendingPayouts: validPayouts.length,
      totalAmount: validPayouts.reduce((sum, payout) => sum + payout.amount, 0),
      overdueCount: validPayouts.filter(p => p.isOverdue).length,
      delayedCount: validPayouts.filter(p => p.isDelayed).length,
      readyToReleaseCount: validPayouts.filter(p => p.canRelease && !p.isDelayed).length,
      averageAge: validPayouts.length > 0 ?
        Math.round(validPayouts.reduce((sum, p) => sum + p.fundAgeInDays, 0) / validPayouts.length) : 0,
      currencies: [...new Set(validPayouts.map(p => p.currency))],
      insufficientFundsCount: validPayouts.filter(p =>
        p.escrowAccount && !p.escrowAccount.hasSufficientFunds
      ).length
    };

    res.status(200).json({
      success: true,
      message: `Found ${validPayouts.length} pending payouts`,
      data: validPayouts,
      summary: summary,
      count: validPayouts.length
    });

  } catch (error) {
    console.error('Error fetching pending payouts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending payouts',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

export const updateDefaultPaymentMethod = async (req, res) => {
  try {
    const { userId, paymentMethodId } = req.body;

    if (!userId || !paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and payment method ID are required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify the payment method belongs to the user
    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: 'card',
    });

    const isValidMethod = paymentMethods.data.some(pm => pm.id === paymentMethodId);

    if (!isValidMethod) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method for this user'
      });
    }

    // Update default payment method in Stripe
    await stripe.customers.update(user.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    // Update user in database
    user.defaultPaymentMethod = paymentMethodId;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Default payment method updated successfully'
    });

  } catch (error) {
    console.error('Error setting default payment method:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting default payment method',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

export const deletePaymentMethod = async (req, res) => {
  try {
    const { userId, paymentMethodId } = req.query;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Detach payment method from Stripe
    await stripe.paymentMethods.detach(paymentMethodId);

    // If it was the default payment method, clear it
    if (user.defaultPaymentMethod === paymentMethodId) {
      user.defaultPaymentMethod = null;
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'Payment method deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting payment method:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting payment method',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

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
      console.log(`User or Job not found: userId=${userId}, jobId=${jobId}`);
      return res.status(404).json({
        success: false,
        message: 'User or Job not found'
      });
    }

    if (job.userId.toString() !== userId.toString()) {
      console.log(userId, job.userId.toString());
      console.log(`User ${userId} is not the owner of job ${jobId}`);
      console.log(`User ${userId} attempted to fund job ${jobId} they do not own`);
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to fund this project'
      });
    }

    // Validate job state
    if (job.status !== 'open' || job.isFunded) {
      console.log(`Job ${jobId} is not fundable: status=${job.status}, isFunded=${job.isFunded}`);
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
    console.log(`Funding job ${jobId} with amount: $${totalAmount}, platform fee: $${platformFee}`);

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

    console.log(`Project ${jobId} funded successfully by user ${userId}`);

    try {
      await createEscrowForFundedProject(jobId, userId)
    } catch (error) {
      console.error('Escrow creation failed:', err);
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

export const getAccountStatus = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user || !user.stripeAccountId) {
      return res.status(404).json({
        success: false,
        message: 'No Stripe account found'
      });
    }

    const account = await stripe.accounts.retrieve(user.stripeAccountId);

    res.status(200).json({
      success: true,
      account: {
        id: account.id,
        payouts_enabled: account.payouts_enabled,
        charges_enabled: account.charges_enabled,
        details_submitted: account.details_submitted,
        requirements: account.requirements,
        capabilities: account.capabilities
      }
    });

  } catch (error) {
    console.error('Error fetching account status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch account status',
      error: error.message
    });
  }
};


export const releaseFunds = async (req, res) => {
  try {
    const { contractId, userId } = req.body;
    console.log('Releasing funds for contract:', contractId, 'by user:', userId);

    if (!contractId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Contract ID and User ID are required'
      });
    }

    const contract = await Contract.findById({ _id: contractId })
      .populate('jobId')
      .populate('contractorId', 'stripeAccountId');

    console.log('Found contract:', contract);

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    console.log('Contract found:', contract);

    if (contract.clientId.toString() !== userId.toString()) {
      console.log(`User ${userId} is not the client of contract ${contractId}`);
      return res.status(403).json({
        success: false,
        message: 'Only contract client can release funds'
      });
    }

    if (contract.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Contract must be completed to release funds'
      });
    }

    // Find associated fund
    const fund = await Fund.findOne({ job_id: contract.jobId._id });
    if (!fund) {
      return res.status(404).json({
        success: false,
        message: 'Fund not found for this job'
      });
    }

    if (fund.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'Funds are not available for release'
      });
    }

    fund.contractor_id = contract.contractorId._id;
    fund.status = 'pending_review';
    await fund.save();

    // Create pending release transaction
    const releaseTransaction = new EscrowTransaction({
      fund_id: fund._id,
      type: 'release',
      amount: fund.amount,
      currency: fund.currency,
      initiated_by: userId,
      status: 'pending',
      notes: `Funds released by client for contract: ${contractId}`
    });
    await releaseTransaction.save();

    fund.status = FUND_STATUS.PENDING_RELEASE;
    fund.available_after = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    await fund.save();

    await Transactions.create({
      userId: contract.contractorId._id,
      jobId: contract.jobId._id,
      type: 'payout_pending',
      amount: fund.amount,
      status: 'pending',
      paymentMethod: 'escrow',
      description: `Funds released - available in 5 days`
    });

    res.status(200).json({
      success: true,
      message: 'Funds released successfully. Awaiting admin approval.',
      transactionId: releaseTransaction._id
    });

  } catch (error) {
    console.error('Error releasing funds:', error);
    res.status(500).json({
      success: false,
      message: 'Error releasing funds',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

export const withdrawFunds = async (req, res) => {
  try {
    const { fundId, userId } = req.body;
    
    const fund = await Fund.findOne({
      _id: fundId,
      contractor_id: userId,
      status: FUND_STATUS.PENDING_RELEASE,
      available_after: { $lte: new Date() }
    });

    if (!fund) {
      return res.status(400).json({
        success: false,
        message: 'Funds not available for withdrawal'
      });
    }

    // Process payout via Stripe
    const contractor = await User.findById(userId);
    const payout = await stripe.payouts.create({
      amount: Math.round(fund.amount * 100),
      currency: fund.currency,
      destination: contractor.bankAccounts[0].id // Use default bank account
    });

    // Update fund status
    fund.status = FUND_STATUS.WITHDRAWN;
    await fund.save();

    // Create transaction
    await Transactions.create({
      userId,
      jobId: fund.job_id,
      type: 'payout',
      amount: fund.amount,
      status: 'completed',
      paymentMethod: 'bank_account',
      description: 'Funds withdrawn to bank account',
      stripePayoutId: payout.id
    });

    res.status(200).json({ success: true, message: 'Funds withdrawn successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Withdrawal failed',
      error: error.message
    });
  }
}

export const savePaymentMethod = async (req, res) => {
  try {
    const { token, userId } = req.body;

    console.log('Received request to save payment method:', { userId, token });

    if (!token || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Token and user ID are required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let customerId = user.stripeCustomerId;
    let paymentMethodId = null;
    console.log(`User ${userId} Stripe customer ID: ${customerId}`);

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: userId
        }
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        token: token
      }
    });

    console.log(`Created payment method for user ${userId}:`, paymentMethod.id);

    await stripe.paymentMethods.attach(paymentMethod.id, {
      customer: customerId
    });
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethod.id
      }
    });

    user.defaultPaymentMethod = paymentMethod.id;
    await user.save();

    const transaction = await Transactions.create({
      userId,
      type: 'payment_method_added',
      amount: 0,
      status: 'completed',
      paymentMethod: 'card',
      stripeCustomerId: customerId,
      stripePaymentMethodId: paymentMethod.id,
      description: 'Payment method saved for future transactions'
    });

    console.log(`Payment method saved for user ${userId}:`, transaction)

    const savedPaymentMethod = await stripe.paymentMethods.retrieve(paymentMethod.id);
    const cardInfo = savedPaymentMethod.card;
    console.log(`Card info for user ${userId}:`, cardInfo);

    res.status(200).json({
      success: true,
      message: 'Payment method saved successfully',
      data: {
        transactionId: transaction._id,
        customerId: customerId,
        paymentMethodId: paymentMethod.id,
        cardLast4: cardInfo.last4,
        cardBrand: cardInfo.brand,
        cardExpMonth: cardInfo.exp_month,
        cardExpYear: cardInfo.exp_year
      }
    });

  } catch (error) {
    console.error('Error saving payment method:', error);

    if (error.type === 'StripeCardError') {
      return res.status(400).json({
        success: false,
        message: 'Card error: ' + error.message
      });
    }

    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: ' + error.message
      });
    }

    if (error.type === 'StripeAuthenticationError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication with Stripe failed'
      });
    }

    if (error.type === 'StripeAPIError') {
      return res.status(500).json({
        success: false,
        message: 'Stripe API error occurred'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error saving payment method',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

export const saveBankAccount = async (req, res) => {
  try {
    const { userId, token } = req.body;
    console.log('Saving bank account for user:', userId);
    console.log('Received token:', token);

    if (!userId || !token) {
      return res.status(400).json({
        success: false,
        message: 'User ID and token are required'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify token with Stripe
    const bankAccountToken = await stripe.tokens.retrieve(token);
    if (!bankAccountToken.bank_account) {
      return res.status(400).json({ success: false, message: 'Invalid bank account token' });
    }

    const bankDetails = bankAccountToken.bank_account;

    // Create Stripe Connect account if it doesn't exist
    if (!user.stripeAccountId) {
      try {
        const account = await stripe.accounts.create({
          type: 'express',
          email: user.email,
          capabilities: {
            transfers: { requested: true },
          },
          business_type: 'individual',
          individual: {
            email: user.email,
            first_name: user.name.split(' ')[0] || user.name,
            last_name: user.name.split(' ').slice(1).join(' ') || '',
          },
        });

        user.stripeAccountId = account.id;
        await user.save();
        console.log('Created Stripe Connect account:', account.id);
      } catch (error) {
        console.error('Error creating Stripe Connect account:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to create payment account',
          error: error.message
        });
      }
    }

    // Add bank account to Stripe Connect account
    let externalAccount;
    try {
      externalAccount = await stripe.accounts.createExternalAccount(user.stripeAccountId, {
        external_account: token
      });
      console.log('External account created:', externalAccount);
    } catch (error) {
      console.error('Error creating external account:', error);
      return res.status(400).json({
        success: false,
        message: 'Bank account verification failed',
        error: error.message
      });
    }

    // Save bank account details to user document
    const newBankAccount = {
      id: externalAccount.id,
      bankName: bankDetails.bank_name || 'Unknown Bank',
      last4: bankDetails.last4,
      country: bankDetails.country,
      currency: bankDetails.currency,
      isDefault: !user.bankAccounts || user.bankAccounts.length === 0
    };

    // Initialize bankAccounts array if it doesn't exist
    if (!user.bankAccounts) {
      user.bankAccounts = [];
    }

    user.bankAccounts.push(newBankAccount);
    await user.save();

    console.log('Bank account saved successfully for user:', userId);

    res.status(200).json({
      success: true,
      message: 'Bank account saved successfully',
      bankAccount: newBankAccount
    });
  } catch (error) {
    console.error('Error saving bank account:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving bank account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const createOnboardingLink = async (req, res) => {
  try {
    const userId = req.params.id;

    console.log('hit createonboardlink: ', userId)
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.stripeAccountId) {
      return res.status(400).json({
        success: false,
        message: 'No Stripe account found. Please add a bank account first.'
      });
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: user.stripeAccountId,
      refresh_url: `${process.env.FRONTEND_URL}/payment/payout-setup?refresh=true`,
      return_url: `${process.env.FRONTEND_URL}/payment/payout-setup?success=true`,
      type: 'account_onboarding',
    });

    res.status(200).json({
      success: true,
      onboardingUrl: accountLink.url
    });

  } catch (error) {
    console.error('Error creating onboarding link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create onboarding link',
      error: error.message
    });
  }
};



export const createBankAccount = async (req, res) => {
  try {
    const { userId, bankToken } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const bankAccount = await stripe.customers.createSource(
      user.stripeCustomerId,
      { source: bankToken }
    );

    user.bankAccountId = bankAccount.id;
    await user.save();

    res.status(200).json({
      success: true,
      bankAccountId: bankAccount.id,
      last4: bankAccount.last4
    });
  } catch (error) {
    console.error('Error creating bank account:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating bank account',
      error: error.message
    });
  }
};

export const createFreelancerAccount = async (userId) => {
  const user = await User.findById(userId);

  const account = await stripe.accounts.create({
    type: 'express',
    email: user.email,
    capabilities: {
      transfers: { requested: true },
    },
    business_type: 'individual',
    individual: {
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
    },
  });

  user.stripeAccountId = account.id;
  await user.save();

  // Create account link for onboarding
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: 'http://localhost:3000/payment/disburse',
    return_url: 'http://localhost:3000/payment/disburse',
    type: 'account_onboarding',
  });

  return accountLink.url;
};

export const verifyBankAccount = async (req, res) => {
  try {
    const { userId, amounts } = req.body; // amounts is [32, 45] for example

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const defaultAccount = user.bankAccounts.find(acc => acc.isDefault);
    if (!defaultAccount) {
      return res.status(400).json({ success: false, message: 'No default bank account' });
    }

    await stripe.accounts.verifyExternalAccount(
      user.stripeAccountId,
      defaultAccount.id,
      { amounts } // [32, 45] for example
    );

    res.status(200).json({ success: true, message: 'Bank account verified' });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Verification failed',
      error: error.message
    });
  }
};


const generateIdempotencyKey = (fundId, adminId) => {
  return `transfer-${fundId}-${adminId}`;
};

export const cleanupLock = async (req, res, next) => {
  if (req.lockKey) {
    await Lock.deleteOne({ key: req.lockKey });
  }
  next();
};

export const approvePayout = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const fundId = req.params.id;
    const { adminId } = req.query;
    
    if (!fundId || !adminId) {
      return res.status(400).json({
        success: false,
        message: 'Fund ID and Admin ID are required'
      });
    }

    const idempotencyKey = generateIdempotencyKey(fundId, adminId);

   const fund = await Fund.findOneAndUpdate(
      {
        _id: fundId,
        status: { $in: [FUND_STATUS.PENDING_REVIEW, FUND_STATUS.IN_REVIEW] },
        is_processed: false,
        stripe_transfer_id: { $exists: false }
      },
      {
        $set: {
          is_processed: true,
          status: FUND_STATUS.IN_REVIEW,
          processing_attempts: { $inc: 1 }
        }
      },
      {
        new: true,
        session,
        populate: [
          { path: 'client_id', select: 'stripeCustomerId' },
          { path: 'contractor_id', select: 'stripeAccountId bankAccounts' },
          { path: 'job_id' }
        ]
      }
    );

    if (!fund) {
      await session.abortTransaction();
      
      const existingFund = await Fund.findById(fundId);
      if (existingFund?.is_processed || existingFund?.stripe_transfer_id) {
        return res.status(409).json({
          success: false,
          message: 'Payment already processed',
          data: { transferId: existingFund.stripe_transfer_id }
        });
      }
      
      return res.status(404).json({
        success: false,
        message: 'Fund not found or not in payable state'
      });
    }

    if (fund.status === FUND_STATUS.RELEASED) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'Payment already released'
      });
    }

    if (![FUND_STATUS.PENDING_REVIEW, FUND_STATUS.IN_REVIEW].includes(fund.status)) {
      console.log(`Fund not in payable state: ${fund.status}`);
      return res.status(400).json({
        success: false,
        message: `Fund not in payable state. Current status: ${fund.status}`
      });
    }

    if (fund.is_delayed) {
      console.log(`Payout delayed until ${fund.delay_until}`);
      return res.status(400).json({
        success: false,
        message: `Payout delayed until ${fund.delay_until}`
      });
    }

    const existingTransaction = await Transaction.findOne({
      fund_id: fundId,
      status: TRANSACTION_STATUS.COMPLETED
    }).session(session);

    if (existingTransaction) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'Transaction already exists',
        data: { transactionId: existingTransaction._id }
      });
    }

    

    const contractor = fund.contractor_id;
    const client = fund.client_id;

    const accountExists = await stripe.accounts.retrieve(contractor.stripeAccountId);
    if (!accountExists || accountExists.deleted) {
      await Fund.findByIdAndUpdate(fundId, {
        is_processed: false,
        status: FUND_STATUS.PENDING_REVIEW
      }, { session });
      
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Contractor Stripe account does not exist or has been deleted'
      });
    }

    if (accountExists.capabilities.transfers !== 'active') {
      await Fund.findByIdAndUpdate(fundId, {
        is_processed: false,
        status: FUND_STATUS.PENDING_REVIEW
      }, { session });
      
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Account not ready for transfers. Please complete verification.'
      });
    }

    if (!contractor.stripeAccountId) {
      console.log('Contractor has no Stripe account ID');
      return res.status(400).json({
        success: false,
        message: 'Contractor has incomplete payment setup'
      });
    }

    const escrowAccount = await EscrowAccount.findOneAndUpdate(
      {
        client_id: client._id,
        balance: { $gte: fund.amount }, // Ensure sufficient balance
        frozen: false
      },
      {
        $inc: {
          balance: -fund.amount,
          total_released: fund.amount
        }
      },
      { new: true, session }
    );

    if (!escrowAccount) {
      await Fund.findByIdAndUpdate(fundId, {
        is_processed: false,
        status: FUND_STATUS.PENDING_REVIEW
      }, { session });
      
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Insufficient escrow funds or account frozen'
      });
    }

    if (!escrowAccount) {
      console.log('Escrow account not found for client:', client._id);
      return res.status(400).json({
        success: false,
        message: 'Escrow account not found'
      });
    }

    if (escrowAccount.balance < fund.amount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient escrow funds. Available: ${escrowAccount.balance} ${fund.currency}`
      });
    }

    const platformFeePercentage = 0.05;
    const platformFee = parseFloat((fund.amount * platformFeePercentage).toFixed(2));
    const netAmount = parseFloat((fund.amount - platformFee).toFixed(2));

    const netAmountCents = Math.round(netAmount * 100);
    const feeCents = Math.round(platformFee * 100);


    const transfer = await stripe.transfers.create({
      amount: netAmountCents,
      currency: fund.currency.toLowerCase(),
      destination: contractor.stripeAccountId,
      metadata: {
        fundId: fundId,
        jobId: fund.job_id._id.toString(),
        adminId: adminId,
        platformFee: feeCents,
        type: 'contractor_payment'
      }
    }, {
      idempotencyKey: idempotencyKey
    });

    console.log('Transfer Created/Released: ', transfer);

    await Fund.findByIdAndUpdate(fundId, {
      $set: {
        status: FUND_STATUS.RELEASED,
        released_at: new Date(),
        stripe_transfer_id: transfer.id,
      }
    }, { session });

    escrowAccount.balance = parseFloat((escrowAccount.balance - fund.amount).toFixed(2));
    escrowAccount.total_released = parseFloat((escrowAccount.total_released + fund.amount).toFixed(2));
    await escrowAccount.save({ session });

    fund.released_at = new Date();
    fund.admin_notes = `Approved by admin ${adminId} at ${new Date().toISOString()}`;
    fund.status = FUND_STATUS.RELEASED;
    await fund.save({ session });

    const releaseTransaction = await Transaction.create([{
      fund_id: fund._id,
      amount: fund.amount,
      currency: fund.currency,
      status: TRANSACTION_STATUS.COMPLETED,
      notes: `Transfer to contractor. Net: ${netAmount} ${fund.currency}`,
      external_transaction_id: transfer.id,
      fee_amount: platformFee,
      userId: fund.contractor_id._id
    }], { session });


    const jobMilestones = await Fund.find({ 
      job_id: fund.job_id._id 
    }).session(session);
    
    const allMilestonesPaid = jobMilestones.every(m =>
      m.status === FUND_STATUS.RELEASED
    );

    if (allMilestonesPaid) {
      await Job.findByIdAndUpdate(
        fund.job_id._id,
        { status: 'completed', isPaidOut: true },
        { session }
      );
    }

    await session.commitTransaction();

    console.log('Transfer approved successfully:', transfer);

    res.status(200).json({
      success: true,
      message: 'Transfer approved successfully',
      data: {
        transferId: transfer.id,
        netAmount,
        platformFee,
        currency: fund.currency,
        releaseTransaction: releaseTransaction[0]
      }
    });

  } catch (error) {
    await session.abortTransaction();

    console.error('Transfer approval failed:', error);

    if (error.type === 'StripeAPIError' || error.type === 'StripeConnectionError') {
      return res.status(502).json({
        success: false,
        message: 'Payment processing error',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Transfer approval failed',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

export const preventConcurrentProcessing = async (req, res, next) => {
  const fundId = req.params.id;
  const lockKey = `processing_${fundId}`;
  
  // Using Redis would be better, but for now we can use MongoDB
  const lock = await Lock.findOneAndUpdate(
    { key: lockKey },
    { 
      $set: { 
        expires_at: new Date(Date.now() + 30000), // 30 second lock
        created_at: new Date() 
      }
    },
    { upsert: true, new: true }
  );
  
  if (lock.created_at < new Date(Date.now() - 30000)) {
    return res.status(423).json({
      success: false,
      message: 'Another request is currently processing this fund'
    });
  }
  
  req.lockKey = lockKey;
  next();
};

