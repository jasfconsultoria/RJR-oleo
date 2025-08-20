import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, addMonths, parseISO, isValid } from 'date-fns';
import { DateInput } from '@/components/ui/date-input';
import { formatCurrency } from '@/lib/utils';
import { IMaskInput } from 'react-imask';
import { useToast } from '@/components/ui/use-toast';

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

const InstallmentTable = ({
  totalValue,
  downPayment,
  installmentsNumber,
  issueDate,
  onInstallmentsChange,
  existingInstallments = [],
  isEditing = false,
  isViewMode = false,
  onInstallmentsNumberChange,
}) => {
  const [installments, setInstallments] = useState([]);
  const [installmentErrors, setInstallmentErrors] = useState([]);
  const { toast } = useToast();

  // Calcula as parcelas sempre que as props relevantes mudam
  useEffect(() => {
    const remainingValue = totalValue - downPayment;
    if (installmentsNumber <= 0 || remainingValue < 0 || !isValid(issueDate)) {
      if (installments.length > 0) {
        setInstallments([]);
        onInstallmentsChange([]);
      }
      return;
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

    if (!deepEqual(newInstallments, installments)) {
      setInstallments(newInstallments);
      onInstallmentsChange(newInstallments);
      setInstallmentErrors(Array(newInstallments.length).fill(''));
    }
    // eslint-disable-next-line
  }, [totalValue, downPayment, installmentsNumber, issueDate, existingInstallments, isEditing, onInstallmentsChange]);

  const handleInstallmentValueChange = (index, value) => {
    let newAmount = isNaN(Number(value)) ? 0 : Number(value);

    const updatedInstallments = [...installments];
    const remainingValueForInstallments = totalValue - downPayment;
    const lastInstallmentIndex = updatedInstallments.length - 1;

    const newErrors = Array(installments.length).fill('');

    if (newAmount === 0) {
      newErrors[index] = 'O valor da parcela não pode ser zero.';
      updatedInstallments[index].expected_amount = 0;
      setInstallmentErrors(newErrors);
      setInstallments(updatedInstallments);
      onInstallmentsChange(updatedInstallments);
      return;
    }

    if (installmentsNumber > 1 && index === 0 && Math.abs(newAmount - remainingValueForInstallments) < 0.01) {
      const singleInstallment = [{
        ...updatedInstallments[0],
        expected_amount: remainingValueForInstallments,
      }];
      setInstallments(singleInstallment);
      onInstallmentsChange(singleInstallment);
      onInstallmentsNumberChange(1);
      toast({
        title: 'Parcela única ajustada',
        description: 'A primeira parcela cobre o saldo restante. O número de parcelas foi ajustado para 1.',
        variant: 'default',
      });
      return;
    }

    const sumOfOtherInstallments = updatedInstallments.reduce((sum, inst, i) => {
      if (i === index) return sum;
      return sum + inst.expected_amount;
    }, 0);

    const maxAllowedAmountForCurrent = parseFloat((remainingValueForInstallments - sumOfOtherInstallments).toFixed(2));

    if (newAmount > maxAllowedAmountForCurrent + 0.01 && index !== lastInstallmentIndex) {
      newErrors[index] = `Valor muito alto. Máximo permitido: ${formatCurrency(maxAllowedAmountForCurrent)}.`;
      newAmount = maxAllowedAmountForCurrent;
    }

    updatedInstallments[index].expected_amount = newAmount;

    if (lastInstallmentIndex >= 0) {
      const sumOfAllButLast = updatedInstallments.slice(0, -1).reduce((sum, inst) => sum + inst.expected_amount, 0);
      const expectedLastInstallment = parseFloat((remainingValueForInstallments - sumOfAllButLast).toFixed(2));

      if (index === lastInstallmentIndex) {
        if (Math.abs(newAmount - expectedLastInstallment) > 0.01) {
          newErrors[index] = `O valor da parcela deve ser ${formatCurrency(expectedLastInstallment)} para fechar corretamente o total.`;
          updatedInstallments[index].expected_amount = expectedLastInstallment;
        }
      } else {
        updatedInstallments[lastInstallmentIndex].expected_amount = expectedLastInstallment;
      }

      if (updatedInstallments[lastInstallmentIndex].expected_amount < 0) {
        updatedInstallments[lastInstallmentIndex].expected_amount = 0;
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
                        as={Input}
                        value={String(installment.expected_amount)}
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