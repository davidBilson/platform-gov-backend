import Transactions from '../../models/transactions.model.js';
import User from '../../models/user.model.js';
import PlatformFees from '../../models/platform.fees.model.js';
import Stripe from 'stripe';
import { Fund, Transaction as EscrowTransaction, EscrowAccount } from '../../models/escrow.model.js';
import Contract from '../../models/contract.model.js';

import Transaction from '../../models/transactions.model.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_51RZUzrQpiUcmNrzkun1iqWcxZjk6cZXYc5AtPPznpa9D8vNxzLTVZp836xHyzCnbt7Jl7Qes97bv0TlXMnAO29mU00fuaY1StL';

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