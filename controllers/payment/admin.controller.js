// admin.controller.js
import { Fund, EscrowAccount, AdminAction } from '../../models/escrow.model.js';

// Admin updates fund status
export const updateFundStatus = async (req, res) => {
  try {
    const { fundId, status, reason } = req.body;
    const fund = await Fund.findById(fundId);
    
    if (!fund) {
      return res.status(404).json({ success: false, message: 'Fund not found' });
    }

    const previousStatus = fund.status;
    fund.status = status;
    await fund.save();

    // Log admin action
    const action = new AdminAction({
      admin_id: req.user._id,
      action_type: 'fund_status_change',
      target_type: 'fund',
      target_id: fundId,
      previous_state: { status: previousStatus },
      new_state: { status },
      reason
    });
    await action.save();

    res.status(200).json({ success: true, fund });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Status update failed',
      error: error.message 
    });
  }
};

// Admin manages escrow account
export const manageEscrow = async (req, res) => {
  try {
    const { accountId, action, amount, reason } = req.body;
    const account = await EscrowAccount.findById(accountId);
    
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    let actionType = '';
    let previousState = {};
    let newState = {};

    switch (action) {
      case 'freeze':
        previousState = { frozen: account.frozen };
        account.frozen = true;
        newState = { frozen: true };
        actionType = 'account_freeze';
        break;
        
      case 'unfreeze':
        previousState = { frozen: account.frozen };
        account.frozen = false;
        newState = { frozen: false };
        actionType = 'account_unfreeze';
        break;
        
      case 'adjust':
        previousState = { balance: account.balance };
        account.balance += amount;
        newState = { balance: account.balance };
        actionType = 'adjust_escrow_balance';
        break;
        
      default:
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid escrow action' 
        });
    }

    await account.save();

    // Log admin action
    const adminAction = new AdminAction({
      admin_id: req.user._id,
      action_type: actionType,
      target_type: 'escrow_account',
      target_id: accountId,
      previous_state: previousState,
      new_state: newState,
      reason
    });
    await adminAction.save();

    res.status(200).json({ success: true, account });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Escrow management failed',
      error: error.message 
    });
  }
};