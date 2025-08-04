import Hiring from '../models/hiring.model.js';
import JobApplication from '../models/job.applications.model.js';
import Job from '../models/job.created.model.js';

/**
 * @desc    Check if a job has been assigned to someone by checking hiring status
 * @route   GET /api/status/track-job-status
 * @access  Private
 */

export const trackJobStatus = async (req, res) => {
  try {

    const jobId = req.params.id;

    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job ID is required' });
    }

    // Check if the job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Check hiring status for this job
    const hiringRecord = await Hiring.findOne({ jobId })
      .where('status').in(['offered', 'accepted', 'withdrawn']);

    const isAssigned = !!hiringRecord;

    res.status(200).json({
      success: true,
      data: {
        jobId,
        isAssigned: isAssigned,
        hiringStatus: hiringRecord?.status || 'not_assigned',
        jobStatus: job.status
      }
    });
  } catch (error) {
    console.error('Error tracking job status:', error);
    res.status(500).json({ success: false, message: 'Server error while tracking job status' });
  }
};

export const trackHiringStatus = async (req, res) => {
  try {
    const { jobId, contractorId, clientId } = req.body;

    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job ID is required' });
    }

    let query = { jobId };
    if (contractorId) query.contractorId = contractorId;
    if (clientId) query.clientId = clientId;

    const hiringRecord = await Hiring.findOne(query);

    if (!hiringRecord) {
      return res.status(404).json({
        success: true,
        data: {
          hiringStatus: 'not_offered',
          message: 'No hiring record found for this job'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        hiringStatus: hiringRecord.status,
        offerDetails: hiringRecord.offerDetails,
        clientNotes: hiringRecord.clientNotes,
        contractorNotes: hiringRecord.contractorNotes,
        updatedAt: hiringRecord.updatedAt
      }
    });
  } catch (error) {
    console.error('Error tracking hiring status:', error);
    res.status(500).json({ success: false, message: 'Server error while tracking hiring status' });
  }
};

/**
 * @desc    Track the job application status
 * @route   GET /api/status/track-job-application-status
 * @access  Private
 */
export const trackJobApplicationStatus = async (req, res) => {
  try {
    const { jobId, freelancerId, applicationId } = req.body;

    if (!jobId && !applicationId) {
      return res.status(400).json({
        success: false,
        message: 'Either jobId or applicationId is required'
      });
    }

    let query = {};
    if (applicationId) {
      query._id = applicationId;
    } else {
      query.jobId = jobId;
      if (freelancerId) query.freelancerId = freelancerId;
    }

    const application = await JobApplication.findOne(query)
      .select('status viewedAt interviews clientNotes updatedAt');

    if (!application) {
      return res.status(404).json({
        success: true,
        data: {
          applicationStatus: 'not_applied',
          message: 'No application found'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        applicationStatus: application.status,
        viewedAt: application.viewedAt,
        lastUpdated: application.updatedAt,
        interviews: application.interviews,
        clientNotes: application.clientNotes
      }
    });
  } catch (error) {
    console.error('Error tracking job application status:', error);
    res.status(500).json({ success: false, message: 'Server error while tracking application status' });
  }
};

/**
 * @desc    Update the job application status
 * @route   PUT /api/status/update-job-application-status
 * @access  Private
 */
export const updateJobApplicationStatus = async (req, res) => {
  try {
    const { applicationId, status } = req.body;

    if (!applicationId || !status) {
      return res.status(400).json({
        success: false,
        message: 'Application ID and status are required'
      });
    }

    // Validate status
    const validStatuses = ['draft', 'pending', 'viewed', 'active'];
    if (!validStatuses.includes(status)) {
      console.error('Invalid status value:', status);
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const updateData = { status };

    // If status is being set to 'viewed' and it hasn't been viewed before
    if (status === 'viewed') {
      updateData.$setOnInsert = { viewedAt: new Date() };
    }

    const updatedApplication = await JobApplication.findByIdAndUpdate(
      applicationId,
      updateData,
      { new: true, runValidators: true }
    ).select('status clientNotes viewedAt updatedAt');

    if (!updatedApplication) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        applicationId: updatedApplication._id,
        newStatus: updatedApplication.status,
        clientNotes: updatedApplication.clientNotes,
        viewedAt: updatedApplication.viewedAt,
        updatedAt: updatedApplication.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating job application status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating application status',
      error: error.message
    });
  }
};