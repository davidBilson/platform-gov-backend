import express from 'express';
import {
  startWorkSession,
  stopWorkSession,
  getTimesheetLogs,
  approveTimesheetEntry,
  disputeTimesheetEntry
} from '../controllers/contract/timesheet.controller.js';
import { timesheetUpload } from '../middleware/multer-timesheet-upload.js';


const router = express.Router();

router.post('/:contractId/sessions/start', startWorkSession);

router.route('/:contractId/sessions/:sessionId/stop').put( timesheetUpload, stopWorkSession);

router.get('/:contractId/logs', getTimesheetLogs);

router.put('/:contractId/logs/:logId/approve', approveTimesheetEntry);

router.put('/:contractId/logs/:logId/dispute', disputeTimesheetEntry);

export default router;