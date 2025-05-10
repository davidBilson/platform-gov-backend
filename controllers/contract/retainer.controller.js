import Contract from '../../models/contract.model.js';
// import { sendNotification } from '../utils/notificationService.js';

/**
 * @desc    Process retainer payment (system/admin)
 * @route   POST /api/contracts/:contractId/retainer/pay
 * @access  Private (admin/system)
 */
export const processRetainerPayment = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { amount, periodStart, periodEnd, transactionId } = req.body;

    const contract = await Contract.findById(contractId);
    if (!contract || contract.paymentStructure !== 'retainer') {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found or invalid payment structure' 
      });
    }

    if (!contract.retainer) {
      return res.status(400).json({ 
        success: false, 
        message: 'Retainer details not configured' 
      });
    }

    // Create payment record
    const paymentRecord = {
      amount,
      paymentDate: new Date(),
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      transactionId,
      status: 'completed'
    };

    // Update retainer details
    contract.retainer.paymentHistory.push(paymentRecord);
    contract.retainer.lastPaymentDate = new Date();
    
    // Calculate next payment date based on frequency
    const nextDate = new Date(contract.retainer.lastPaymentDate);
    switch (contract.retainer.frequency) {
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'bi-weekly':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
    }
    
    contract.retainer.nextPaymentDate = nextDate;
    await contract.save();

    // Notify both parties
    // await sendNotification({
    //   userId: contract.contractorId,
    //   title: 'Retainer Payment Processed',
    //   message: `Retainer payment of $${amount} has been completed`,
    //   type: 'payment',
    //   referenceId: contractId
    // });

    // await sendNotification({
    //   userId: contract.clientId,
    //   title: 'Retainer Payment Processed',
    //   message: `Retainer payment of $${amount} has been completed`,
    //   type: 'payment',
    //   referenceId: contractId
    // });

    res.status(200).json({
      success: true,
      data: paymentRecord,
      message: 'Retainer payment processed successfully'
    });

  } catch (error) {
    console.error('Error processing retainer payment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error processing retainer payment',
      error: error.message 
    });
  }
};

/**
 * @desc    Update retainer details (client only)
 * @route   PUT /api/contracts/:contractId/retainer
 * @access  Private (client)
 */
export const updateRetainerDetails = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { recurringAmount, frequency } = req.body;
    const userId = req.user._id;

    // Validate contract exists and belongs to this client
    const contract = await Contract.findOne({
      _id: contractId,
      clientId: userId,
      paymentStructure: 'retainer'
    });

    if (!contract) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found or invalid payment structure' 
      });
    }

    // Update retainer details
    contract.retainer.recurringAmount = recurringAmount;
    contract.retainer.frequency = frequency;
    await contract.save();

    // // Notify contractor
    // await sendNotification({
    //   userId: contract.contractorId,
    //   title: 'Retainer Terms Updated',
    //   message: 'The terms of your retainer agreement have been updated',
    //   type: 'retainer',
    //   referenceId: contractId
    // });

    res.status(200).json({
      success: true,
      data: contract.retainer,
      message: 'Retainer details updated successfully'
    });

  } catch (error) {
    console.error('Error updating retainer details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error updating retainer details',
      error: error.message 
    });
  }
};