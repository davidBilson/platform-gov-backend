

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