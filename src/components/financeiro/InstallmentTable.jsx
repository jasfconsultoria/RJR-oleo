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
  onInstallmentsNumberChange, // New prop to update parent's installments_number
}) => {
  const [installments, setInstallments] = useState([]);
  const [installmentErrors, setInstallmentErrors] = useState([]);
  const { toast } = useToast();

  const calculateInstallments = useCallback(() => {
    const remainingValue = totalValue - downPayment;
    if (installmentsNumber <= 0 || remainingValue < 0 || !isValid(issueDate)) {
      return [];
    }

    const baseInstallmentValue = Math.floor((remainingValue / installmentsNumber) * 100) / 100;
    const totalOfBaseInstallments = baseInstallmentValue * installmentsNumber;
    const roundingDifference = parseFloat((remainingValue - totalOfBaseInstallments).toFixed(2));

    const newInstallments = Array.from({ length: installmentsNumber }, (_, i) => {
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
    return newInstallments;
  }, [totalValue, downPayment, installmentsNumber, issueDate, isEditing, existingInstallments]);

  useEffect(() => {
    const newInstallments = calculateInstallments();
    setInstallments(newInstallments);
    onInstallmentsChange(newInstallments);
    setInstallmentErrors(Array(newInstallments.length).fill('')); // Initialize errors
  }, [calculateInstallments, onInstallmentsChange]);


  const handleInstallmentValueChange = (index, value) => {
    let newAmount = parseFloat(value); // 'value' from onAccept is already the unmasked number
    if (isNaN(newAmount)) newAmount = 0;

    const updatedInstallments = [...installments];
    const remainingValueForInstallments = totalValue - downPayment;
    const lastInstallmentIndex = updatedInstallments.length - 1;

    const newErrors = Array(installments.length).fill(''); // Reset all errors for simplicity on each change

    // 1. Validate for zero amount
    if (newAmount === 0) {
      newErrors[index] = 'O valor da parcela não pode ser zero.';
      updatedInstallments[index].expected_amount = 0;
      setInstallmentErrors(newErrors);
      setInstallments(updatedInstallments);
      onInstallmentsChange(updatedInstallments);
      return;
    }

    // 2. Handle case where first installment equals remaining balance (and there are multiple installments)
    if (installmentsNumber > 1 && index === 0 && Math.abs(newAmount - remainingValueForInstallments) < 0.01) {
      const singleInstallment = [{
        ...updatedInstallments[0],
        expected_amount: remainingValueForInstallments,
      }];
      setInstallments(singleInstallment);
      onInstallmentsChange(singleInstallment);
      onInstallmentsNumberChange(1); // Inform parent to update installments_number
      toast({
        title: 'Parcela única ajustada',
        description: 'A primeira parcela cobre o saldo restante. O número de parcelas foi ajustado para 1.',
        variant: 'default',
      });
      return;
    }

    // Calculate sum of other installments (excluding the one being edited)
    const sumOfOtherInstallments = updatedInstallments.reduce((sum, inst, i) => {
      if (i === index) return sum;
      return sum + inst.expected_amount;
    }, 0);

    // Determine the maximum allowed amount for the current installment
    const maxAllowedAmountForCurrent = parseFloat((remainingValueForInstallments - sumOfOtherInstallments).toFixed(2));

    // If the user tries to set a value that makes the last installment negative
    if (newAmount > maxAllowedAmountForCurrent + 0.01 && index !== lastInstallmentIndex) { // +0.01 for float tolerance
      newErrors[index] = `Valor muito alto. Máximo permitido: ${formatCurrency(maxAllowedAmountForCurrent)}.`;
      newAmount = maxAllowedAmountForCurrent; // Cap the value
    }

    // Apply the (potentially capped) new amount to the current installment
    updatedInstallments[index].expected_amount = newAmount;

    // Redistribute the remaining balance to the last installment
    if (lastInstallmentIndex >= 0) {
      const sumOfAllButLast = updatedInstallments.slice(0, -1).reduce((sum, inst) => sum + inst.expected_amount, 0);
      const expectedLastInstallment = parseFloat((remainingValueForInstallments - sumOfAllButLast).toFixed(2));

      // If the user is editing the last installment, validate its value
      if (index === lastInstallmentIndex) {
        if (Math.abs(newAmount - expectedLastInstallment) > 0.01) {
          newErrors[index] = `O valor da parcela deve ser ${formatCurrency(expectedLastInstallment)} para fechar corretamente o total.`;
          updatedInstallments[index].expected_amount = expectedLastInstallment; // Auto-correct
        }
      } else {
        // If editing a non-last installment, auto-adjust the last one
        updatedInstallments[lastInstallmentIndex].expected_amount = expectedLastInstallment;
      }

      // Ensure the last installment is not negative after adjustment
      if (updatedInstallments[lastInstallmentIndex].expected_amount < 0) {
        updatedInstallments[lastInstallmentIndex].expected_amount = 0;
        // This case should ideally be prevented by the capping logic above, but as a fallback
        // it ensures no negative display. The overall sum validation will still catch it.
      }
    }

    setInstallmentErrors(newErrors);
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
                    <>
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
                        as={Input} // Adicionado o prop 'as={Input}' aqui
                        value={installment.expected_amount} // Passa o número diretamente
                        onAccept={(value) => handleInstallmentValueChange(index, value)}
                        placeholder="0,00"
                        className={`w-24 bg-white/5 border-white/20 text-white text-right h-10 px-3 py-2 rounded-md text-sm ${installmentErrors[index] ? 'border-yellow-500' : ''}`}
                      />
                      {installmentErrors[index] && <p className="text-yellow-400 text-xs mt-1">{installmentErrors[index]}</p>}
                    </>
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
        <div className={`mt-4 p-3 rounded-md text-sm font-medium bg-yellow-500/20 text-yellow-300`}>
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