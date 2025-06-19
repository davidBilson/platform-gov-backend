// import emailService from '../utils/nodemailer.js';
// emailService.sendEmail({ to, subject, text })
import Transactions from '../../models/transactions.model.js';
import User from '../../models/user.model.js';
import Job from '../../models/job.created.model.js';
import PlatformFees from '../../models/platform.fees.model.js';
import Stripe from 'stripe';
import { createEscrowForFundedProject } from './escrow.controller.js';

const STRIPE_SECRET_KEY = process?.env?.STRIPE_SECRET_KEY || 'sk_test_51RZUzrQpiUcmNrzkun1iqWcxZjk6cZXYc5AtPPznpa9D8vNxzLTVZp836xHyzCnbt7Jl7Qes97bv0TlXMnAO29mU00fuaY1StL';

if (!STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not defined in environment variables');
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

export const stripe = new Stripe(STRIPE_SECRET_KEY);

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

export const setDefaultPaymentMethod = async (req, res) => {
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

export const getAvailableBalance = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Calculate available balance from completed jobs
    const completedJobs = await Job.find({
      freelancerId: userId,
      status: 'completed',
      isPaidOut: false
    });
    
    const balance = completedJobs.reduce((sum, job) => sum + job.price, 0);
    
    res.status(200).json({ success: true, availableBalance: balance });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching balance' });
  }
};

export const processWithdrawal = async (req, res) => {
  try {
    const { userId, amount, paymentMethodId } = req.body;
    
    // Verify user has sufficient balance
    const balanceResponse = await getAvailableBalance(userId);
    if (balanceResponse.availableBalance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient funds' });
    }

    // Create payout
    const payout = await stripe.payouts.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      method: 'instant',
      destination: paymentMethodId
    });

    // Update transactions
    const transaction = await Transactions.create({
      userId,
      type: 'payout',
      amount: amount,
      status: 'pending',
      paymentMethod: 'bank_account',
      stripePayoutId: payout.id
    });

    res.status(200).json({ success: true, payoutId: payout.id });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Withdrawal failed' });
  }
};


