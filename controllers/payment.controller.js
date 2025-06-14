import Job from '../models/job.created.model.js';
import User from '../models/user.model.js';
import Transaction from '../models/transactions.model.js';
import Stripe from 'stripe';

// Better error handling for Stripe initialization
// const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_SECRET_KEY = 'sk_test_51RZUzrQpiUcmNrzkun1iqWcxZjk6cZXYc5AtPPznpa9D8vNxzLTVZp836xHyzCnbt7Jl7Qes97bv0TlXMnAO29mU00fuaY1StL';

if (!STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not defined in environment variables');
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

export const savePaymentMethod = async (req, res) => {
  try {
    const { jobId, token } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    const job = await Job.findById(jobId);
    
    if (!user || !job) {
      return res.status(404).json({ success: false, message: 'User or Job not found' });
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        source: token
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    } else {
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: { token }
      });
      
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
    }

    const transaction = await Transaction.create({
      userId,
      jobId,
      type: 'payment_method_added',
      amount: 0,
      status: 'completed',
      paymentMethod: 'card',
      stripeCustomerId: customerId
    });

    res.status(200).json({ 
      success: true, 
      message: 'Payment method saved successfully',
      transactionId: transaction._id
    });

  } catch (error) {
    console.error('Error saving payment method:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error saving payment method',
      error: error.message 
    });
  }
};

export const fundProject = async (req, res) => {
  try {
    const { jobId } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    const job = await Job.findById(jobId);
    
    if (!user || !job) {
      return res.status(404).json({ success: false, message: 'User or Job not found' });
    }

    if (!user.stripeCustomerId) {
      return res.status(400).json({ 
        success: false, 
        message: 'No payment method found. Please add a payment method first.' 
      });
    }

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
        amount = job.price * 40; // Initial 40 hours
        description = `Initial hourly payment (40hrs) for job: ${job.jobTitle}`;
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid payment type' 
        });
    }

    // Add 3% platform fee
    const platformFee = Math.round(amount * 0.03);
    const totalAmount = amount + platformFee;

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount * 100, // in cents
      currency: 'usd',
      customer: user.stripeCustomerId,
      payment_method: user.defaultPaymentMethod,
      off_session: true,
      confirm: true,
      description,
      metadata: {
        jobId: job._id.toString(),
        userId: user._id.toString()
      }
    });

    // Update job status
    job.isFunded = true;
    job.paymentIntentId = paymentIntent.id;
    job.status = 'active';
    await job.save();

    // Record transaction
    const transaction = await Transaction.create({
      userId,
      jobId,
      type: 'project_funding',
      amount: totalAmount,
      fee: platformFee,
      status: 'completed',
      paymentMethod: 'card',
      stripePaymentIntentId: paymentIntent.id,
      netAmount: amount
    });

    res.status(200).json({ 
      success: true, 
      message: 'Project funded successfully',
      transactionId: transaction._id,
      amount: totalAmount
    });

  } catch (error) {
    console.error('Error funding project:', error);
    
    if (error.code === 'authentication_required') {
      return res.status(400).json({ 
        success: false, 
        message: 'Authentication required for this payment method' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error funding project',
      error: error.message 
    });
  }
};