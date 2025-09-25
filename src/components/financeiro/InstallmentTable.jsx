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
    const remainingValue = totalValue - downPayment; // Este é um float, ex: 100.00
    if (installmentsNumber <= 0 || remainingValue < 0 || !isValid(issueDate)) {
      return [];
    }

    const newInstallments = [];
    const totalCents = Math.round(remainingValue * 100); // Trabalhar com centavos para evitar problemas de float
    const baseCentsPerInstallment = Math.floor(totalCents / installmentsNumber);
    let remainderCents = totalCents % installmentsNumber;

    for (let i = 0; i < installmentsNumber; i++) {
      const existing = existingInstallments.find(inst => inst.installment_number === i + 1);
      
      let currentInstallmentCents = baseCentsPerInstallment;
      if (remainderCents > 0) {
        currentInstallmentCents += 1;
        remainderCents -= 1;
      }
      
      const expectedAmount = parseFloat((currentInstallmentCents / 100).toFixed(2)); // Converter centavos de volta para unidades

      newInstallments.push({
        id: existing?.id,
        installment_number: i + 1,
        issue_date: existing?.issue_date ? parseISO(existing.issue_date) : addMonths(issueDate, i + 1),
        expected_amount: isEditing && existing?.expected_amount ? existing.expected_amount : expectedAmount,
        paid_amount: existing?.paid_amount || 0,
        paid_date: existing?.paid_date ? parseISO(existing.paid_date) : null,
        status: existing?.status || 'pending',
      });
    }
    return newInstallments;
  }, [totalValue, downPayment, installmentsNumber, issueDate, isEditing, existingInstallments]);

  useEffect(() => {
    const newInstallments = calculateInstallments();
    setInstallments(newInstallments);
    onInstallmentsChange(newInstallments);
  }, [calculateInstallments, onInstallmentsChange]);


  const handleInstallmentValueChange = (index, value) => {
    const newAmount = parseCurrency(value); // Converte a string de entrada para número
    const updatedInstallments = [...installments];
    const totalExpectedSum = totalValue - downPayment; // Soma alvo para todas as parcelas

    // Validação básica: o valor da parcela não pode ser negativo
    if (newAmount < 0) {
      toast({
        title: 'Valor inválido',
        description: 'O valor da parcela não pode ser negativo.',
        variant: 'destructive',
      });
      return; // Não atualiza o estado com valor inválido
    }

    // Atualiza o valor esperado da parcela atual
    updatedInstallments[index].expected_amount = newAmount;

    // Calcula a soma de todas as parcelas após a edição atual
    const currentTotalInstallmentsSum = updatedInstallments.reduce((sum, inst) => sum + inst.expected_amount, 0);

    // Calcula a diferença necessária para corresponder à soma alvo
    const difference = parseFloat((totalExpectedSum - currentTotalInstallmentsSum).toFixed(2));

    // Se houver uma diferença e houver outras parcelas para ajustar
    if (difference !== 0 && updatedInstallments.length > 1) {
      const lastInstallmentIndex = updatedInstallments.length - 1;
      
      // Ajusta a última parcela apenas se não for a que está sendo editada
      if (index !== lastInstallmentIndex) {
        let adjustedLastInstallmentValue = parseFloat((updatedInstallments[lastInstallmentIndex].expected_amount + difference).toFixed(2));
        
        // Impede que a última parcela se torne negativa
        if (adjustedLastInstallmentValue < 0) {
          toast({
            title: 'Ajuste de parcela',
            description: `O valor da última parcela foi ajustado para R$ 0,00. A soma das parcelas anteriores excede o saldo restante.`,
            variant: 'destructive',
          });
          updatedInstallments[lastInstallmentIndex].expected_amount = 0;
        } else {
          updatedInstallments[lastInstallmentIndex].expected_amount = adjustedLastInstallmentValue;
        }
      } else {
        // Se a última parcela está sendo editada, apenas verifica se a soma total está correta.
        // Se não, informa o usuário e opcionalmente força o valor correto.
        if (Math.abs(difference) > 0.01) { // Permite pequena tolerância
          toast({
            title: 'Valor incorreto',
            description: `A soma das parcelas não corresponde ao saldo restante. Ajuste o valor para ${formatCurrency(newAmount + difference)}.`,
            variant: 'destructive',
          });
          // Força o valor correto para a última parcela que está sendo editada
          updatedInstallments[index].expected_amount = parseFloat((newAmount + difference).toFixed(2));
        }
      }
    } else if (updatedInstallments.length === 1 && Math.abs(difference) > 0.01) {
        // Se houver apenas uma parcela e ela não corresponder ao total
        toast({
            title: 'Valor incorreto',
            description: `O valor da parcela deve ser ${formatCurrency(totalExpectedSum)}.`,
            variant: 'destructive',
        });
        updatedInstallments[index].expected_amount = totalExpectedSum;
    }

    // Garante que nenhuma parcela individual seja negativa após todos os ajustes
    updatedInstallments.forEach((inst, i) => {
      if (inst.expected_amount < 0) {
        updatedInstallments[i].expected_amount = 0;
      }
    });

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
                      // Passa o valor diretamente, o IMaskInput se encarrega de formatar para exibição
                      value={String(installment.expected_amount)}
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