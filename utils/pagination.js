// utils/pagination.js
export const formatPagination = (paginationData) => {
  return {
    currentPage: paginationData.page,
    totalPages: paginationData.totalPages,
    totalDocs: paginationData.totalDocs,
    limit: paginationData.limit,
    hasNextPage: paginationData.hasNextPage,
    hasPrevPage: paginationData.hasPrevPage,
    nextPage: paginationData.nextPage,
    prevPage: paginationData.prevPage
  };
};