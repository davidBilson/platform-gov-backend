// Updated timesheet routes
import express from 'express';
import {
  startWorkSession,
  stopWorkSession,
  getTimesheetLogs,
  approveTimesheetEntry,
  disputeTimesheetEntry,
  logHoursManually,
  setMaxHours
} from '../controllers/contract/timesheet.controller.js';
import { timesheetUpload } from '../middleware/multer-timesheet-upload.js';


const router = express.Router();

router.post('/:contractId/sessions/start', startWorkSession);

router.put('/:contractId/sessions/:sessionId/stop', 
  timesheetUpload,
  stopWorkSession
);

router.get('/:contractId/logs', getTimesheetLogs);

router.put('/:contractId/logs/:logId/approve', approveTimesheetEntry);

router.put('/:contractId/logs/:logId/dispute', disputeTimesheetEntry);

router.post('/log-hours-manually/:id', timesheetUpload, logHoursManually);

router.put('/set-max-hours/:id', setMaxHours);

export default router;