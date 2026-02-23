import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({
  className,
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  totalCount,
  ...props
}) => {
  if (totalPages <= 1) {
    return null;
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className={cn("flex items-center justify-between flex-wrap gap-x-6 gap-y-4", className)} {...props}>
      <div className="flex items-center gap-2">
        {totalCount > 0 && (
          <p className="text-sm font-medium text-white">
            Exibindo {startItem}–{endItem} de {totalCount} registros
          </p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={currentPage === 1}
            className="rounded-xl"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          <span className="text-sm font-medium text-white">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={currentPage === totalPages}
            className="rounded-xl"
          >
            Próximo
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
};
export { Pagination };
export default Pagination;

