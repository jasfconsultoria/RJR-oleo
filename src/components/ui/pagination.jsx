import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';

const Pagination = ({
  className,
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  totalCount,
  ...props
}) => {
  const [goToPage, setGoToPage] = useState('');

  useEffect(() => {
    setGoToPage(currentPage.toString());
  }, [currentPage]);

  if (totalPages <= 1) {
    return null;
  }

  const handleGoToPage = (e) => {
    if (e) e.preventDefault();
    const pageNumber = parseInt(goToPage);
    if (!isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages) {
      onPageChange(pageNumber);
    } else {
      setGoToPage(currentPage.toString());
    }
  };

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
            className="rounded-xl border-white/20 text-white hover:bg-white/10"
          >
            Próximo
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>

          <div className="flex items-center gap-2 ml-4 border-l border-white/10 pl-4">
            <span className="text-xs text-white/60 whitespace-nowrap">Ir pág:</span>
            <form onSubmit={handleGoToPage} className="flex items-center gap-1">
              <Input
                type="text"
                value={goToPage}
                onChange={(e) => setGoToPage(e.target.value.replace(/\D/g, ''))}
                onBlur={handleGoToPage} // Also trigger on blur for convenience
                className="w-10 h-8 bg-white/10 border-white/20 text-white text-center text-[10px] p-0 rounded-lg focus-visible:ring-emerald-500"
              />
              <Button 
                type="submit"
                size="icon"
                variant="ghost" 
                className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                title="Pular para página"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export { Pagination };
export default Pagination;

