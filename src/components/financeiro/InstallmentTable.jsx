import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MinusCircle } from 'lucide-react';
import { format, addMonths, parseISO, isValid } from 'date-fns';
import { DateInput } from '@/components/ui/date-input';
import { formatCurrency, parseCurrency } from '@/lib/utils';

const InstallmentTable = ({
  totalValue,
  downPayment,
  installmentsNumber,
  issueDate,
  onInstallmentsChange,
  existingInstallments = [], // For editing existing entries
  isEditing = false,
  isViewMode = false,
}) => {
  const [installments, setInstallments] = useState([]);

  const calculateInstallments = useCallback(() => {
    const remainingValue = totalValue - downPayment;
    if (installmentsNumber <= 0 || remainingValue < 0 || !isValid(issueDate)) {
      return [];
    }

    const baseInstallmentValue = Math.floor((remainingValue / installmentsNumber) * 100) / 100;
    const totalOfBaseInstallments = baseInstallmentValue * installmentsNumber;
    const roundingDifference = parseFloat((remainingValue - totalOfBaseInstallments).toFixed(2));

    return Array.from({ length: installmentsNumber }, (_, i) => {
      const existing = existingInstallments.find(inst => inst.installment_number === i + 1);
      let finalInstallmentValue = baseInstallmentValue;
      if (i === installmentsNumber - 1) {
        finalInstallmentValue += roundingDifference;
      }
      return {
        id: existing?.id,
        installment_number: i + 1,
        issue_date: existing?.issue_date ? parseISO(existing.issue_date) : addMonths(issueDate, i + 1),
        expected_amount: isEditing && existing?.expected_amount ? existing.expected_amount : parseFloat(finalInstallmentValue.toFixed(2)),
        paid_amount: existing?.paid_amount || 0,
        paid_date: existing?.paid_date ? parseISO(existing.paid_date) : null,
        status: existing?.status || 'pending',
      };
    });
  }, [totalValue, downPayment, installmentsNumber, issueDate, isEditing, existingInstallments]);

  useEffect(() => {
    const newInstallments = calculateInstallments();
    setInstallments(newInstallments);
    onInstallmentsChange(newInstallments);
  }, [calculateInstallments, onInstallmentsChange]);


  const handleInstallmentValueChange = (index, value) => {
    const newInstallments = [...installments];
    newInstallments[index].expected_amount = parseCurrency(value);
    setInstallments(newInstallments);
    onInstallmentsChange(newInstallments);
  };

  const handleIssueDateChange = (index, date) => {
    const newInstallments = [...installments];
    newInstallments[index].issue_date = date;
    setInstallments(newInstallments);
    onInstallmentsChange(newInstallments);
  };

  const getInstallmentBalance = (installment) => {
    return installment.expected_amount - (installment.paid_amount || 0);
  };

  if (installmentsNumber <= 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Detalhes das Parcelas</h3>
      <div className="overflow-x-auto">
        <Table className="responsive-table">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
              <TableHead className="text-white">Parcela</TableHead>
              <TableHead className="text-white text-right">Valor (R$)</TableHead>
              <TableHead className="text-white">Vencimento</TableHead>
              {isViewMode && <TableHead className="text-white text-right">Pago (R$)</TableHead>}
              {isViewMode && <TableHead className="text-white text-right">Saldo (R$)</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {installments.map((installment, index) => (
              <TableRow key={installment.installment_number} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                <TableCell data-label="Parcela" className="font-medium">{installment.installment_number}</TableCell>
                <TableCell data-label="Valor (R$)" className="text-right">
                  {isViewMode ? formatCurrency(installment.expected_amount) : (
                    <Input
                      type="text"
                      value={formatCurrency(installment.expected_amount)}
                      onChange={(e) => handleInstallmentValueChange(index, e.target.value)}
                      className="w-24 bg-white/5 border-white/20 text-white text-right"
                    />
                  )}
                </TableCell>
                <TableCell data-label="Vencimento">
                  {isViewMode ? (
                    isValid(installment.issue_date) ? format(installment.issue_date, 'dd/MM/yyyy') : 'N/A'
                  ) : (
                    <DateInput
                      date={installment.issue_date}
                      setDate={(date) => handleIssueDateChange(index, date)}
                    />
                  )}
                </TableCell>
                {isViewMode && (
                  <>
                    <TableCell data-label="Pago (R$)" className="text-right">
                      {formatCurrency(installment.paid_amount)}
                    </TableCell>
                    <TableCell data-label="Saldo (R$)" className="text-right font-bold">
                      {formatCurrency(getInstallmentBalance(installment))}
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
            {installments.length === 0 && (
              <TableRow>
                <TableCell colSpan={isViewMode ? 5 : 3} className="text-center text-gray-400 py-4">
                  Nenhuma parcela gerada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default InstallmentTable;