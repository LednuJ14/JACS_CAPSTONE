import React from 'react';

const Pagination = ({ currentPage = 1, totalPages = 1, onPageChange = () => {} }) => {
  const pages = Math.max(1, totalPages);
  const canPrev = currentPage > 1;
  const canNext = currentPage < pages;
  const nums = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(pages, currentPage + 2);
  for (let i = start; i <= end; i++) nums.push(i);

  return (
    <div className="flex justify-center items-center space-x-1 md:space-x-2 mb-8">
      <button
        onClick={() => canPrev && onPageChange(currentPage - 1)}
        disabled={!canPrev}
        className={`px-3 py-2 md:px-4 rounded-lg text-sm md:text-base ${canPrev ? 'text-gray-600 hover:text-black hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
      >
        Previous
      </button>
      {nums.map(n => (
        <button
          key={n}
          onClick={() => onPageChange(n)}
          className={`px-3 py-2 md:px-4 rounded-lg text-sm md:text-base ${n === currentPage ? 'bg-black text-white' : 'text-gray-600 hover:text-black hover:bg-gray-100'}`}
        >
          {n}
        </button>
      ))}
      <button
        onClick={() => canNext && onPageChange(currentPage + 1)}
        disabled={!canNext}
        className={`px-3 py-2 md:px-4 rounded-lg text-sm md:text-base ${canNext ? 'text-gray-600 hover:text-black hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
      >
        Next
      </button>
    </div>
  );
};

export default Pagination;
