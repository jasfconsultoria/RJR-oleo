// Forçando atualização do componente (Hot Reload) - Lógica de quitação automática.
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IMaskInput } from 'react-imask';
import { DateInput } from '@/components/ui/date-input';
import InstallmentTable from '@/components/financeiro/InstallmentTable';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';

export const InstallmentDetails = ({
  formData,
  handleInputChange,
  downPaymentInputRef,
  downPaymentError,
  singleDueDate,
  setSingleDueDate,
  parsedTotalValue,
  parsedDownPayment,
  showInstallments,
  handleInstallmentsChange,
  onInstallmentsNumberChange,
  existingInstallments,
  isEditing,
}) => {
  const handleDownPaymentBlur = () => {
    const remaining = parsedTotalValue - parsedDownPayment;
    // Se a entrada for igual ao total (quitação à vista), forçar 0 parcelas
    if (Math.abs(remaining) < 0.01 && parsedTotalValue > 0) {
      handleInputChange({ target: { name: 'installments_number', value: 0 } });
      if (onInstallmentsNumberChange) onInstallmentsNumberChange(0);
    }
    // Se houver saldo e o número de parcelas for <= 0 ou vazio, sugerir pelo menos 1
    else if (remaining > 0.01 && (parseInt(formData.installments_number, 10) <= 0 || !formData.installments_number)) {
      handleInputChange({ target: { name: 'installments_number', value: 1 } });
      if (onInstallmentsNumberChange) onInstallmentsNumberChange(1);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-white/20">
      <div>
        <Label htmlFor="down_payment" className="text-lg">Valor de Entrada (R$)</Label>
        <IMaskInput
          ref={downPaymentInputRef}
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
          value={formData.down_payment}
          lazy={true}
          onAccept={(value) => handleInputChange({ target: { name: 'down_payment', value: value } })}
          onBlur={handleDownPaymentBlur}
          placeholder="0,00"
          inputMode="decimal"
          className={`w-full flex h-10 rounded-xl border ${downPaymentError ? 'border-red-500' : 'border-white/20'} bg-white/5 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 !text-right`}
        />
        {downPaymentError && <p className="text-red-500 text-xs mt-1">{downPaymentError}</p>}
      </div>
      <div>
        {parsedDownPayment === 0 && parsedTotalValue > 0 && (
          <>
            <Label htmlFor="single_due_date" className="text-lg">Vencimento</Label>
            <DateInput date={singleDueDate} setDate={setSingleDueDate} />
          </>
        )}
        {parsedDownPayment > 0 && (
          <>
            <Label htmlFor="down_payment_due_date" className="text-lg">Vencimento da Entrada</Label>
            <Input
              id="down_payment_due_date"
              value={format(formData.issue_date, 'dd/MM/yyyy')}
              disabled
              className="bg-white/5 border-white/20 rounded-xl"
            />
          </>
        )}
      </div>

      {parsedTotalValue > 0 && (
        <>
          <div>
            <Label htmlFor="saldo" className="text-lg">Saldo (R$)</Label>
            <Input
              id="saldo"
              value={formatCurrency(parsedTotalValue - parsedDownPayment)}
              disabled
              className="bg-white/5 border-white/20 rounded-xl font-bold text-right"
            />
          </div>
          <div>
            {showInstallments && (
              <>
                <Label htmlFor="installments_number" className="text-lg">Número de Parcelas</Label>
                <Input
                  id="installments_number"
                  name="installments_number"
                  type="number"
                  // Removido min="1"
                  value={formData.installments_number}
                  onChange={(e) => handleInputChange({ target: { name: 'installments_number', value: parseInt(e.target.value, 10) || 0 } })} // Alterado || 1 para || 0
                  disabled={Math.abs(parsedTotalValue - parsedDownPayment) < 0.01}
                  className="bg-white/5 border-white/20 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </>
            )}
          </div>
        </>
      )}

      {showInstallments && formData.installments_number > 0 && (
        <div className="md:col-span-2">
          <InstallmentTable
            totalValue={parsedTotalValue}
            downPayment={parsedDownPayment}
            installmentsNumber={formData.installments_number}
            issueDate={formData.issue_date}
            onInstallmentsChange={handleInstallmentsChange}
            onInstallmentsNumberChange={onInstallmentsNumberChange}
            existingInstallments={existingInstallments}
            isEditing={isEditing}
          />
        </div>
      )}
    </div>
  );
};