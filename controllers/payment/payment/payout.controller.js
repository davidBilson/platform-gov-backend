import Job from '../../../models/job.created.model.js';
import Stripe from 'stripe';
import { Fund, Transaction as EscrowTransaction, EscrowAccount, TRANSACTION_STATUS, FUND_STATUS } from '../../../models/escrow.model.js';
import Contract from '../../../models/contract.model.js';

import Transaction from '../../../models/transactions.model.js';
import mongoose from 'mongoose';

const STRIPE_SECRET_KEY = process?.env?.STRIPE_SECRET_KEY || 'sk_test_51RZUzrQpiUcmNrzkun1iqWcxZjk6cZXYc5AtPPznpa9D8vNxzLTVZp836xHyzCnbt7Jl7Qes97bv0TlXMnAO29mU00fuaY1StL';

if (!STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not defined in environment variables');
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

export const stripe = new Stripe(STRIPE_SECRET_KEY);

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
        .sort({ created_at: -1 }); // Most recent first
  
  
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
  
              // Job details - now this will work with populate
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
  
              // Client details
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
  
              // Contract details
              contract: contract ? {
                id: contract._id,
                hiringId: contract.hiringId,
                startDate: contract.startDate,
                status: contract.status,
                paymentStructure: contract.paymentStructure,
                milestonesCount: contract.milestones ? contract.milestones.length : 0,
                completedMilestones: contract.milestones ?
                  contract.milestones.filter(m => m.status === 'approved').length : 0,
                timesheetsCount: contract.timesheets ? contract.timesheets.length : 0,
                hasRetainer: !!contract.retainer,
                createdAt: contract.createdAt
              } : null,
  
              // Escrow account details
              escrowAccount: escrowAccount ? {
                balance: escrowAccount.balance,
                currency: escrowAccount.currency,
                frozen: escrowAccount.frozen,
                totalFunded: escrowAccount.total_funded,
                totalReleased: escrowAccount.total_released,
                hasSufficientFunds: escrowAccount.balance >= fund.amount
              } : null,
  
              // Recent transactions
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
  
      const fund = await Fund.findById(fundId)
        .populate('client_id', 'stripeCustomerId')
        .populate('contractor_id', 'stripeAccountId bankAccounts')
        .populate('job_id')
        .session(session);
  
        if (fund.status === FUND_STATUS.RELEASED) {
          return res.status(400).json({
            success: false,
            message: 'Payment already released'
          });
        }
  
      if (!fund) {
        console.log('Fund not found')
        return res.status(404).json({
          success: false,
          message: 'Fund not found'
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
  
      const contractor = fund.contractor_id;
      const client = fund.client_id;
  
      const accountExists = await stripe.accounts.retrieve(contractor.stripeAccountId);
      console.log('accountExists', accountExists);
  
      // Check if account is ready for transfers
      if (!accountExists || accountExists.deleted) {
        console.log('Contractor Stripe account does not exist or has been deleted');
        return res.status(400).json({
          success: false,
          message: 'Contractor Stripe account does not exist or has been deleted'
        });
      }
  
      if (accountExists.capabilities.transfers !== 'active') {
        console.log('Transfer capability not active');
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
  
      // Retrieve escrow account
      const escrowAccount = await EscrowAccount.findOne({ client_id: client._id }).session(session);
  
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
         idempotencyKey: `transfer-${fundId}-${Date.now()}`
      });
  
      console.log('Transfer created:', transfer);
  
      // Update escrow account balance
      escrowAccount.balance = parseFloat((escrowAccount.balance - fund.amount).toFixed(2));
      escrowAccount.total_released = parseFloat((escrowAccount.total_released + fund.amount).toFixed(2));
      await escrowAccount.save({ session });
  
      // Update fund status
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
        userId: fund.contractor_id
      }], { session });
  
      console.log('Release transaction created:', releaseTransaction);
  
      const jobMilestones = await Fund.find({ job_id: fund.job_id._id });
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
  
      // Handle Stripe errors specifically
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