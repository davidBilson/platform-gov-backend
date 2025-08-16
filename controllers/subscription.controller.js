import { v4 as uuidv4 } from 'uuid';

import Stripe from 'stripe';
import Subscription from '../models/subscriptions.model.js';
import Transactions from '../models/transactions.model.js';
import User from '../models/user.model.js';
import AdminSubscriptionSettings from '../models/admin.subscription.settings.model.js';
import DiscountToken from '../models/discount.tokens.model.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not defined in environment variables');
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

export const stripe = new Stripe(STRIPE_SECRET_KEY);

export const subscribe = async (req, res) => {
  try {
    const { planName, userType, billingInterval, subscriptionAmount, currency = 'USD', autoRenew } = req.body;
    const { userId } = req.query;

    // Validate required inputs
    if (!planName || !userType || !billingInterval || !subscriptionAmount) {
      return res.status(400).json({
        success: false,
        message: 'Plan name, user type, billing interval, and subscription amount are required'
      });
    }

    if (!['monthly', 'annual'].includes(billingInterval)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid billing interval. Must be monthly or annual'
      });
    }

    if (!['contractor', 'client'].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type. Must be contractor or client'
      });
    }

    if (!['free', 'premium'].includes(planName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan name. Must be free or premium'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (userType !== user.role) {
      return res.status(400).json({
        success: false,
        message: `User type mismatch: expected ${user.role}, got ${userType}`
      });
    }

    if (!user.stripeCustomerId || !user.defaultPaymentMethod) {
      console.log(`User ${userId} does not have a Stripe customer ID or default payment method`);
      return res.status(400).json({
        success: false,
        message: 'Payment method not set up',
        reason: 'payment_method_not_set_up'
      });
    }

    // Check for existing active subscription
    const existingSubscription = await Subscription.findOne({
      userId,
      status: { $in: ['active', 'cancelled', 'expired', 'pending'] },
      'subscriptionPeriod.endDate': { $gt: new Date() }
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: 'User already has an active subscription'
      });
    }

    // Check Stripe payment setup
    if (!user.stripeCustomerId || !user.defaultPaymentMethod) {
      console.log(`User ${userId} does not have a Stripe customer ID or default payment method`);
      return res.status(400).json({
        success: false,
        message: 'Payment method not set up'
      });
    }

    // Calculate subscription period
    const startDate = new Date();
    const endDate = new Date(startDate);
    if (billingInterval === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Generate subscription token
    const subscriptionToken = uuidv4();

    const description = `${planName} subscription (${billingInterval}) for ${userType}`;

    // Create PaymentIntent with idempotency key
    const idempotencyKey = `sub-${userId}-${Date.now()}`;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(subscriptionAmount * 100),
      currency: currency.toLowerCase(),
      customer: user.stripeCustomerId,
      payment_method: user.defaultPaymentMethod,
      off_session: true,
      confirm: true,
      description,
      metadata: {
        userId: user._id.toString(),
        planName,
        userType,
        billingInterval
      }
    }, {
      idempotencyKey
    });

    // Handle authentication requirements
    if (paymentIntent.status === 'requires_action') {
      console.log(`Payment requires authentication for user ${userId}`);
      return res.status(200).json({
        success: false,
        requires_action: true,
        client_secret: paymentIntent.client_secret,
        message: 'Payment requires authentication'
      });
    }

    if (paymentIntent.status !== 'succeeded') {
      console.log(`Payment failed for user ${userId}: status=${paymentIntent.status}`);
      return res.status(400).json({
        success: false,
        message: `Payment failed: ${paymentIntent.status}`
      });
    }

    // Create subscription document
    const subscription = await Subscription.create({
      userId,
      userType,
      token: subscriptionToken,
      billingInterval,
      planName,
      subscriptionAmount,
      currency: currency.toUpperCase(),
      subscriptionPeriod: {
        startDate,
        endDate
      },
      subscriptionPaymentIntent: paymentIntent.id,
      status: 'active',
      autoRenew
    });

    const transaction = await Transactions.create({
      userId,
      subscriptionId: subscription._id,
      type: 'subscription_payment',
      amount: subscriptionAmount,
      fee: 0,
      netAmount: subscriptionAmount,
      currency: currency.toLowerCase(),
      status: 'completed',
      paymentMethod: 'stripe',
      stripePaymentIntentId: paymentIntent.id,
      stripeCustomerId: user.stripeCustomerId,
      description
    });

    user.isSubscribed = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Subscription created successfully',
      subscription: {
        id: subscription._id,
        status: 'active',
        planName,
        userType,
        billingInterval,
        amount: subscriptionAmount,
        currency: currency.toUpperCase(),
        startDate,
        endDate
      },
      transactionId: transaction._id
    });

  } catch (error) {
    console.error('Error creating subscription:', error);

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


export const cancelSubscription = async (req, res) => {
  try {
    const { userId } = req.query;
    const { cancelReason } = req.body;

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

    // Find active subscription
    const subscription = await Subscription.findOne({
      userId,
      status: 'active',
      'subscriptionPeriod.endDate': { $gt: new Date() }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    // Update subscription - flip autoRenew to false and set cancelled status
    subscription.autoRenew = false;
    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    if (cancelReason) {
      subscription.cancelReason = cancelReason;
    }
    await subscription.save();

    // Create transaction record for cancellation
    const transaction = await Transactions.create({
      userId,
      subscriptionId: subscription._id,
      type: 'subscription_cancelled',
      amount: 0, // No money involved in cancellation
      fee: 0,
      netAmount: 0,
      currency: subscription.currency.toLowerCase(),
      status: 'completed',
      paymentMethod: 'stripe',
      stripeCustomerId: user.stripeCustomerId,
      description: `${subscription.planName} subscription cancelled (${subscription.billingInterval})`
    });

    // Note: user.isSubscribed remains true since they still have access until endDate

    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      subscription: {
        id: subscription._id,
        status: 'cancelled',
        planName: subscription.planName,
        billingInterval: subscription.billingInterval,
        cancelledAt: subscription.cancelledAt,
        cancelReason: subscription.cancelReason,
        endDate: subscription.subscriptionPeriod.endDate // They still have access until end date
      },
      transactionId: transaction._id
    });

  } catch (error) {
    console.error('Error cancelling subscription:', error);

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const checkSubscriptionStatus = async (req, res) => {
  try {
    const { userId } = req.query;

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

    // Find the user's current subscription (active or recently cancelled but still valid)
    const currentSubscription = await Subscription.findOne({
      userId,
      status: { $in: ['active', 'cancelled'] },
      'subscriptionPeriod.endDate': { $gt: new Date() }
    }).sort({ 'subscriptionPeriod.endDate': -1 }); // Get the latest one

    const currentDate = new Date();
    let subscriptionStatus = {
      isSubscribed: false,
      isPremium: false,
      hasActiveSubscription: false,
      subscription: null
    };

    if (currentSubscription) {
      const isStillValid = currentSubscription.subscriptionPeriod.endDate > currentDate;
      const isPremiumPlan = currentSubscription.planName === 'premium';
      const isActiveStatus = currentSubscription.status === 'active';

      subscriptionStatus = {
        isSubscribed: isStillValid,
        isPremium: isPremiumPlan && isStillValid,
        hasActiveSubscription: isActiveStatus && isStillValid,
        subscription: {
          id: currentSubscription._id,
          planName: currentSubscription.planName,
          userType: currentSubscription.userType,
          status: currentSubscription.status,
          billingInterval: currentSubscription.billingInterval,
          amount: currentSubscription.subscriptionAmount,
          currency: currentSubscription.currency,
          startDate: currentSubscription.subscriptionPeriod.startDate,
          endDate: currentSubscription.subscriptionPeriod.endDate,
          autoRenew: currentSubscription.autoRenew,
          daysRemaining: Math.ceil((currentSubscription.subscriptionPeriod.endDate - currentDate) / (1000 * 60 * 60 * 24)),
          cancelledAt: currentSubscription.cancelledAt,
          cancelReason: currentSubscription.cancelReason
        }
      };
    }

    // Update user.isSubscribed to match actual subscription status
    if (user.isSubscribed !== subscriptionStatus.isSubscribed) {
      user.isSubscribed = subscriptionStatus.isSubscribed;
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'Subscription status retrieved successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isSubscribed: user.isSubscribed
      },
      ...subscriptionStatus,
      // Additional helpful flags
      flags: {
        canAccessPremiumFeatures: subscriptionStatus.isPremium,
        willAutoRenew: currentSubscription?.autoRenew || false,
        isExpiringSoon: currentSubscription ?
          (currentSubscription.subscriptionPeriod.endDate - currentDate) <= (7 * 24 * 60 * 60 * 1000) : false, // 7 days
        needsPaymentMethod: !user.stripeCustomerId || !user.defaultPaymentMethod
      }
    });

  } catch (error) {
    console.error('Error checking subscription status:', error);

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Helper function for internal backend use
export const getUserSubscriptionStatus = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Find the user's current subscription (active or recently cancelled but still valid)
  const currentSubscription = await Subscription.findOne({
    userId,
    status: { $in: ['active', 'cancelled'] },
    'subscriptionPeriod.endDate': { $gt: new Date() }
  }).sort({ 'subscriptionPeriod.endDate': -1 }); // Get the latest one

  const currentDate = new Date();
  let subscriptionStatus = {
    isSubscribed: false,
    isPremium: false,
    hasActiveSubscription: false,
    subscription: null
  };

  if (currentSubscription) {
    const isStillValid = currentSubscription.subscriptionPeriod.endDate > currentDate;
    const isPremiumPlan = currentSubscription.planName === 'premium';
    const isActiveStatus = currentSubscription.status === 'active';

    subscriptionStatus = {
      isSubscribed: isStillValid,
      isPremium: isPremiumPlan && isStillValid,
      hasActiveSubscription: isActiveStatus && isStillValid,
      subscription: {
        id: currentSubscription._id,
        planName: currentSubscription.planName,
        userType: currentSubscription.userType,
        status: currentSubscription.status,
        billingInterval: currentSubscription.billingInterval,
        amount: currentSubscription.subscriptionAmount,
        currency: currentSubscription.currency,
        startDate: currentSubscription.subscriptionPeriod.startDate,
        endDate: currentSubscription.subscriptionPeriod.endDate,
        autoRenew: currentSubscription.autoRenew,
        daysRemaining: Math.ceil((currentSubscription.subscriptionPeriod.endDate - currentDate) / (1000 * 60 * 60 * 24)),
        cancelledAt: currentSubscription.cancelledAt,
        cancelReason: currentSubscription.cancelReason
      }
    };
  }

  // Update user.isSubscribed to match actual subscription status
  if (user.isSubscribed !== subscriptionStatus.isSubscribed) {
    user.isSubscribed = subscriptionStatus.isSubscribed;
    await user.save();
  }

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isSubscribed: user.isSubscribed
    },
    ...subscriptionStatus,
    // Additional helpful flags
    flags: {
      canAccessPremiumFeatures: subscriptionStatus.isPremium,
      willAutoRenew: currentSubscription?.autoRenew || false,
      isExpiringSoon: currentSubscription ?
        (currentSubscription.subscriptionPeriod.endDate - currentDate) <= (7 * 24 * 60 * 60 * 1000) : false, // 7 days
      needsPaymentMethod: !user.stripeCustomerId || !user.defaultPaymentMethod
    }
  };
};

export const resumeSubscription = async (req, res) => {
  try {
    const { userId } = req.query;

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

    // Find cancelled subscription that's still within its paid period
    const subscription = await Subscription.findOne({
      userId,
      status: 'cancelled',
      'subscriptionPeriod.endDate': { $gt: new Date() }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No cancelled subscription found to resume'
      });
    }

    // Check if the user has a valid payment method
    if (!user.stripeCustomerId || !user.defaultPaymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Payment method not set up'
      });
    }

    // Resume subscription - only flip autoRenew back to true
    // Don't clear cancelledAt (keep the history)
    subscription.status = 'active';
    subscription.autoRenew = true;
    // Keep cancelledAt for historical record
    await subscription.save();

    // Create transaction record for resuming (no payment involved)
    const transaction = await Transactions.create({
      userId,
      subscriptionId: subscription._id,
      type: 'subscription_resumed', // ⚠️ Add this to your Transaction enum
      amount: 0, // No payment involved in resuming
      fee: 0,
      netAmount: 0,
      currency: subscription.currency.toLowerCase(),
      status: 'completed',
      paymentMethod: 'stripe',
      stripeCustomerId: user.stripeCustomerId,
      description: `Resumed ${subscription.planName} subscription (${subscription.billingInterval}) - will auto-renew on ${subscription.subscriptionPeriod.endDate.toDateString()}`
    });

    // Check current subscription status and update user accordingly
    const subscriptionStatus = await getUserSubscriptionStatus(userId);

    res.status(200).json({
      success: true,
      message: 'Subscription resumed successfully. Auto-renewal is now enabled.',
      subscription: {
        id: subscription._id,
        status: 'active',
        planName: subscription.planName,
        billingInterval: subscription.billingInterval,
        amount: subscription.subscriptionAmount,
        currency: subscription.currency.toUpperCase(),
        startDate: subscription.subscriptionPeriod.startDate,
        endDate: subscription.subscriptionPeriod.endDate,
        autoRenew: subscription.autoRenew,
        resumedAt: new Date(),
        willRenewOn: subscription.subscriptionPeriod.endDate
      },
      transactionId: transaction._id
    });

  } catch (error) {
    console.error('Error resuming subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const fetchSubscriptionPrices = async (req, res) => {
  try {
    // Fix: Use proper Mongoose query method
    const subscription = await AdminSubscriptionSettings.findOne();

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription pricing not found'
      });
    }

    // Extract just the pricing data instead of returning the entire document
    const prices = {
      consultant: subscription.subscriptionPricing.consultant,
      client: subscription.subscriptionPricing.client,
      // gccDiscount: subscription.gccDiscount,
      adminFeePercent: subscription.adminFeePercent
    };

    res.status(200).json({
      success: true,
      message: 'Subscription prices fetched successfully',
      prices
    });

  } catch (error) {
    console.error('Error fetching subscription prices:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}

export const fetchTips = async (req, res) => {
  try {
    const subscription = await AdminSubscriptionSettings.findOne({}, { tips: 1, _id: 0 });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Tips not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Tips fetched successfully',
      tips: subscription.tips
    });
  } catch (error) {
    console.error('Error fetching tips:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}

