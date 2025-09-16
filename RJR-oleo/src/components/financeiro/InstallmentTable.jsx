import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MinusCircle } from 'lucide-react';
import { format, addMonths, parseISO, isValid } from 'date-fns';
import { DateInput } from '@/components/ui/date-input';
import { formatCurrency, parseCurrency } from '@/lib/utils';
import { IMaskInput } from 'react-imask';
import { useToast } from '@/components/ui/use-toast';

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
  const { toast } = useToast();

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
    const newAmount = parseCurrency(value);
    const updatedInstallments = [...installments];
    
    const totalExpectedSum = totalValue - downPayment;
    
    // Calculate sum of other installments (excluding the one being edited)
    const sumOfOtherInstallments = updatedInstallments.reduce((sum, inst, i) => {
      if (i === index) return sum;
      return sum + inst.expected_amount;
    }, 0);

    // Calculate the correct value for the current installment to make the total sum match
    const correctValueForCurrentInstallment = parseFloat((totalExpectedSum - sumOfOtherInstallments).toFixed(2));

    // If editing the last installment, its value must be exactly what's needed to balance
    if (index === updatedInstallments.length - 1) {
      if (Math.abs(newAmount - correctValueForCurrentInstallment) > 0.01) { // Allow small floating point tolerance
        toast({
          title: 'Valor incorreto',
          description: `O valor da parcela deve ser ${formatCurrency(correctValueForCurrentInstallment)} para fechar corretamente o total.`,
          variant: 'destructive',
        });
        updatedInstallments[index].expected_amount = correctValueForCurrentInstallment;
      } else {
        updatedInstallments[index].expected_amount = newAmount;
      }
    } else {
      // If editing a non-last installment, update its value and adjust the last one
      updatedInstallments[index].expected_amount = newAmount;
      
      const currentSumAfterEdit = updatedInstallments.reduce((sum, inst) => sum + inst.expected_amount, 0);
      const difference = parseFloat((totalExpectedSum - currentSumAfterEdit).toFixed(2));

      if (updatedInstallments.length > 1) {
        updatedInstallments[updatedInstallments.length - 1].expected_amount = parseFloat((updatedInstallments[updatedInstallments.length - 1].expected_amount + difference).toFixed(2));
        
        // Prevent last installment from going negative
        if (updatedInstallments[updatedInstallments.length - 1].expected_amount < 0) {
            updatedInstallments[updatedInstallments.length - 1].expected_amount = 0;
            // If it still doesn't balance, it means the user entered a value too high for a previous installment
            // This scenario should ideally be prevented by the "correctValueForCurrentInstallment" check
            // or by a more complex redistribution. For now, we cap at 0.
        }
      }
    }

    setInstallments(updatedInstallments);
    onInstallmentsChange(updatedInstallments);
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

  // Calculate current total sum of installments for overall validation
  const currentTotalInstallmentsSum = installments.reduce((sum, inst) => sum + inst.expected_amount, 0);
  const overallSum = downPayment + currentTotalInstallmentsSum;
  const differenceFromTotal = parseFloat((totalValue - overallSum).toFixed(2));

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
                    <IMaskInput
                      mask="num"
                      blocks={{
                          num: {
                          mask: Number,
                          thousandsSeparator: '.',
                          radix: ',',
                          mapToRadix: ['.'],
                          scale: 2,
                          padFractionalZeros: true,
                          normalizeZeros: true,
                          signed: false,
                          },
                      }}
                      value={String(installment.expected_amount).replace('.', ',')}
                      onAccept={(value) => handleInstallmentValueChange(index, value)}
                      placeholder="0,00"
                      className="w-24 bg-white/5 border-white/20 text-white text-right h-10 px-3 py-2 rounded-md text-sm"
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
      {overallSum !== totalValue && (
        <div className={`mt-4 p-3 rounded-md text-sm font-medium ${differenceFromTotal > 0 ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
          {differenceFromTotal > 0
            ? `A soma das parcelas é menor que o valor total. Diferença: ${formatCurrency(differenceFromTotal)}`
            : `A soma das parcelas excede o valor total. Diferença: ${formatCurrency(Math.abs(differenceFromTotal))}`
          }
        </div>
      )}
    </div>
  );
};

export default InstallmentTable;