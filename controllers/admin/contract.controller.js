// contract.controller.js
import Contract from "../../models/contract.model.js";
import { formatPagination } from '../../utils/pagination.js';

// Get contract stats
export const getContractStats = async (req, res) => {
  try {
    const totalContracts = await Contract.countDocuments();
    const activeContracts = await Contract.countDocuments({ status: 'active' });
    const completedContracts = await Contract.countDocuments({ status: 'completed' });
    const disputedContracts = await Contract.countDocuments({ status: 'disputed' });

    // Calculate average contract value
    const result = await Contract.aggregate([
      {
        $group: {
          _id: null,
          averageValue: { $avg: "$totalValue" }
        }
      }
    ]);

    const averageContractValue = result.length > 0 ? result[0].averageValue : 0;

    res.json({
      success: true,
      message: 'Contract stats retrieved successfully',
      data: {
        totalContracts,
        activeContracts,
        completedContracts,
        disputedContracts,
        averageContractValue
      }
    });
  } catch (error) {
    console.error('Error fetching contract stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


export const getAllContracts = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalDocs = await Contract.countDocuments(query);

    // Get contracts with pagination
    const contracts = await Contract.find(query)
      .populate('clientId', 'name email')
      .populate('contractorId', 'name email')
      .populate('jobId', 'jobTitle')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Calculate pagination info
    const totalPages = Math.ceil(totalDocs / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    const paginationInfo = {
      docs: contracts,
      totalDocs,
      limit: limitNum,
      page: pageNum,
      totalPages,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? pageNum + 1 : null,
      prevPage: hasPrevPage ? pageNum - 1 : null
    };

    res.json({
      success: true,
      message: 'Contracts retrieved successfully',
      data: {
        contracts: contracts,
        pagination: formatPagination(paginationInfo)
      }
    });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};