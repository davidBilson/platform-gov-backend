import stripe from '@/lib/stripe';
import Payment from '@/models/payment.model';
import Job from '@/models/job.created.model';

// Save payment method
export const savePaymentMethod = async (req, res) => {
  try {
    const { jobId, token } = req.body;
    
    // Create Stripe customer
    const customer = await stripe.customers.create({
      source: token,
      // ... other customer details ...
    });

    // Save payment method to database
    const paymentMethod = await Payment.create({
      jobId,
      clientId: req.user.id,
      methodId: customer.default_source,
      amount: 0,
      status: 'pending'
    });

    res.status(200).json({ success: true, paymentMethod });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Fund project
export const fundProject = async (req, res) => {
  try {
    const { jobId } = req.body;
    const job = await Job.findById(jobId);
    
    if (!job) throw new Error('Job not found');
    
    // Calculate amount based on payment type
    let amount = 0;
    if (job.paymentType === 'fixed-price') {
      amount = job.price;
    } else if (job.paymentType === 'retainer') {
      amount = job.retainerAmount * job.retainerDuration;
    }

    // Create Stripe charge
    const charge = await stripe.charges.create({
      amount: amount * 100, // convert to cents
      currency: 'usd',
      customer: '', // Use the customer's ID from the payment method
      description: "Project funding for " + job.jobTitle
    });

    // Update payment record
    await Payment.findOneAndUpdate(
      { jobId },
      {
        amount,
        status: 'succeeded',
        fundedAt: new Date()
      }
    );

    // Update job status
    await Job.findByIdAndUpdate(jobId, {
      isPaymentVerified: true,
      status: 'funded'
    });

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};