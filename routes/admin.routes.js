import express from 'express';

import { 
  validateAdmin,
  getAllUsers,
  getUserStats,
  toggleUserPriority,
  toggleUserSuspend,
  deleteUser,
  getUserProfile
} from '../controllers/admin/user.controller.js';

import { getAllJobApplications, getAllJobs, getApplicationsByFreelancer, getJobApplicationStats, getJobStats, getJobWithApplications } from '../controllers/admin/job.controller.js';
import { createCategory, deleteCategory, getAllCategories, createItem, deleteItem, getItemsByCategory, getContentStats, updateItemsOrder } from '../controllers/admin/admin-content.controller.js';
import { getContractStats, getAllContracts } from '../controllers/admin/contract.controller.js';
import { getFeeSettings, updateFeeSettings } from '../controllers/admin/fee.settings.controller.js';
import { getDashboardData } from '../controllers/admin/dashboard.controller.js';
import { fetchAllWithdrawals } from '../controllers/payment/withdrawals.controller.js';
import { addAdmin, getAllAdmins, removeAdmin, toggleSuspendAdmin } from '../controllers/admin/admin-management.js';
import { upsertDocument, getDocumentByType } from '../controllers/legalContent.controller.js';

const router = express.Router();

router.use(validateAdmin);

router.get('/get-all-admins', getAllAdmins);
router.post('/add-admin', addAdmin);
router.delete('/remove-admin/:id', removeAdmin);
router.put('/toggle-suspend-admin/:id', toggleSuspendAdmin);

router.get('/get-all-users', getAllUsers);
router.get('/get-user-stats', getUserStats);
router.put('/toggle-priority/:id', toggleUserPriority);
router.put('/toggle-suspend/:id', toggleUserSuspend);
router.get('/user-profile/:id', getUserProfile);
router.get('/get-all-withdrawals', fetchAllWithdrawals);

router.get('/get-all-jobs', getAllJobs);
router.get('/get-job-stats', getJobStats);
router.get('/job/:id/applications', getJobWithApplications);

router.get('/get-all-applications', getAllJobApplications);
router.get('/get-application-stats', getJobApplicationStats);
router.get('/freelancer/:freelancerId/applications', getApplicationsByFreelancer);

router.post('/create-category', createCategory);
router.delete('/delete-category/:id', deleteCategory);
router.get('/get-all-categories', getAllCategories);
router.post('/create-item', createItem);
router.delete('/delete-item/:id', deleteItem);
router.get('/get-items-by-category/:id', getItemsByCategory);
router.get('/stats', getContentStats);
router.put('/update-items-order', updateItemsOrder);

router.get('/get-contract-stats', getContractStats);
router.get('/get-all-contracts', getAllContracts);

router.get('/fee-settings', getFeeSettings);
router.put('/fee-settings', updateFeeSettings);

router.get('/dashboard', getDashboardData);
router.delete('/delete-user/:id', deleteUser);

router.get('/get-legal-content-by-type/:documentType', getDocumentByType);
router.post('/upsert-legal-content', upsertDocument);

export default router;