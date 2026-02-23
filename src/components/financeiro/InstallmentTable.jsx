// Forçando atualização do componente (Hot Reload) - Remoção de alertas confirmada.
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Helper para formatar números para o IMaskInput com vírgula como separador decimal
const formatNumberForInput = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const InstallmentTable = ({
  totalValue,
  downPayment,
  installmentsNumber,
  issueDate,
  onInstallmentsChange,
  onInstallmentsNumberChange, // novo: callback para mudar o número de parcelas
  existingInstallments = [],
  isEditing = false,
  isViewMode = false,
}) => {
  const [installments, setInstallments] = useState([]);
  const [hasUserEditedDates, setHasUserEditedDates] = useState(false);
  const { toast } = useToast();

  const calculateInstallments = useCallback(() => {
    const remainingValue = totalValue - downPayment;
    if (installmentsNumber <= 0 || remainingValue < 0 || !isValid(issueDate)) {
      return [];
    }

    const newInstallments = [];
    const totalCents = Math.round(remainingValue * 100);
    const baseCentsPerInstallment = Math.floor(totalCents / installmentsNumber);
    let remainderCents = totalCents % installmentsNumber;

    for (let i = 0; i < installmentsNumber; i++) {
      const existing = existingInstallments.find(inst => inst.installment_number === i + 1);

      let currentInstallmentCents = baseCentsPerInstallment;
      if (i >= installmentsNumber - remainderCents) {
        currentInstallmentCents += 1;
      }
      // Valores SEMPRE recalculados (não usar existing.expected_amount)
      const expectedAmount = parseFloat((currentInstallmentCents / 100).toFixed(2));

      // Datas: preservar existentes (edição/usuário), senão calcular
      const rawDate = (hasUserEditedDates || isEditing) && existing?.issue_date
        ? parseISO(existing.issue_date)
        : addMonths(issueDate, i + 1);

      newInstallments.push({
        id: existing?.id,
        installment_number: i + 1,
        issue_date: isValid(rawDate) ? rawDate : addMonths(issueDate, i + 1),
        expected_amount: expectedAmount,
        paid_amount: existing?.paid_amount || 0,
        paid_date: existing?.paid_date ? parseISO(existing.paid_date) : null,
        status: existing?.status || 'pending',
      });
    }
    return newInstallments;
  }, [totalValue, downPayment, installmentsNumber, issueDate, isEditing, existingInstallments, hasUserEditedDates]);

  useEffect(() => {
    const newInstallments = calculateInstallments();
    // Comparar apenas números e valores para evitar loops com referências de data
    const toKey = (list) => JSON.stringify(list.map(i => ({ n: i.installment_number, a: i.expected_amount })));
    if (toKey(installments) !== toKey(newInstallments) || installments.length !== newInstallments.length) {
      setInstallments(newInstallments);
      onInstallmentsChange(newInstallments);
    }
  }, [calculateInstallments]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInstallmentValueChange = (index, value) => {
    const newAmount = parseCurrency(value);
    const totalExpectedSum = totalValue - downPayment;

    if (newAmount < 0) {
      toast({
        title: 'Valor inválido',
        description: 'O valor da parcela não pode ser negativo.',
        variant: 'destructive',
      });
      return;
    }

    // Soma das parcelas ANTERIORES ao índice atual
    const sumBefore = installments
      .slice(0, index)
      .reduce((sum, inst) => sum + inst.expected_amount, 0);

    // Quanto sobra para as parcelas APÓS o índice atual
    const leftForNext = parseFloat((totalExpectedSum - sumBefore - newAmount).toFixed(2));
    const subsequentCount = installments.length - index - 1;

    // 1. Ultrapassou o limite total
    if (leftForNext < -0.01) {
      toast({
        title: 'Valor inválido',
        description: `A soma da Entrada mais o valor das parcelas ultrapassa o total do documento (${formatCurrency(totalValue)}).`,
        variant: 'destructive',
      });
      return;
    }

    const updatedInstallments = [...installments];
    updatedInstallments[index].expected_amount = newAmount;

    // 2. Preencheu exatamente o total E tem parcelas restantes -> remover automagicamente
    if (Math.abs(leftForNext) <= 0.01 && subsequentCount > 0) {
      const reduced = updatedInstallments.slice(0, index + 1);
      setInstallments(reduced);
      onInstallmentsChange(reduced);
      // Forçar 0 parcelas pois o total foi atingido
      onInstallmentsNumberChange && onInstallmentsNumberChange(0);
      return;
    }

    // 3. Sobrou saldo → distribuir igualmente entre parcelas subsequentes
    if (leftForNext > 0.01 && subsequentCount > 0) {
      const valuePer = Math.floor((leftForNext * 100) / subsequentCount);
      let distributed = 0;
      for (let i = index + 1; i < updatedInstallments.length; i++) {
        if (i === updatedInstallments.length - 1) {
          // Última parcela absorve o resto (centavos de arredondamento)
          updatedInstallments[i].expected_amount = parseFloat(((leftForNext * 100 - distributed) / 100).toFixed(2));
        } else {
          updatedInstallments[i].expected_amount = parseFloat((valuePer / 100).toFixed(2));
          distributed += valuePer;
        }
      }
    }

    setInstallments(updatedInstallments);
    onInstallmentsChange(updatedInstallments);
  };


  const handleIssueDateChange = (index, date) => {
    // ✅ CORREÇÃO CRÍTICA: Marcar que o usuário editou manualmente e atualizar a data
    if (date && isValid(date)) {
      setHasUserEditedDates(true);

      const newInstallments = [...installments];
      newInstallments[index].issue_date = date;
      setInstallments(newInstallments);
      onInstallmentsChange(newInstallments);
    }
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

      {/* ✅ CORREÇÃO: Adicionar aviso sobre edição de datas */}
      {!isViewMode && (
        <div className="bg-blue-500/20 text-blue-300 p-3 rounded-md text-sm">
          💡 <strong>Dica:</strong> Você pode editar as datas de vencimento clicando no campo de data.
        </div>
      )}

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
                      value={formatNumberForInput(installment.expected_amount)}
                      lazy={false}
                      onAccept={(value) => handleInstallmentValueChange(index, value)}
                      placeholder="0,00"
                      className="w-24 bg-white/5 border-white/20 text-white !text-right h-10 px-3 py-2 rounded-md text-sm"
                      inputMode="decimal"
                    />
                  )}
                </TableCell>
                <TableCell data-label="Vencimento">
                  {isViewMode ? (
                    isValid(installment.issue_date) ? format(installment.issue_date, 'dd/MM/yyyy') : 'N/A'
                  ) : (
                    <div className="w-full">
                      <DateInput
                        date={installment.issue_date}
                        setDate={(date) => handleIssueDateChange(index, date)}
                        className="w-full"
                      />
                      {installment.issue_date < issueDate && (
                        <p className="text-yellow-400 text-xs mt-1">
                          ⚠️ Data anterior à emissão
                        </p>
                      )}
                    </div>
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