import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, PlusCircle } from 'lucide-react';
import { IMaskInput } from 'react-imask';
import { DateInput } from '@/components/ui/date-input';
import ClientOrManualInput from '@/components/financeiro/ClientOrManualInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ClienteForm from '@/pages/ClienteForm';
import CentroCustoForm from '@/pages/CentroCustoForm';

const paymentMethods = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'debit_card', label: 'Cartão de Débito' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'bank_transfer', label: 'Transferência Bancária' },
  { value: 'other', label: 'Outro' },
];

export const FinanceiroFormFields = ({
  formData,
  handleInputChange,
  handleSelectChange,
  handleDateChange,
  handleClientSelectId,
  handleClientNameChange,
  handleClientFantasyNameChange, // NEW: Pass fantasy name handler
  handleCnpjCpfChange,
  costCenters,
  entityLabel,
  clientListVersion,
  isNewClientModalOpen,
  setIsNewClientModalOpen,
  isNewCostCenterModalOpen,
  setIsNewCostCenterModalOpen,
  handleNewClientSuccess,
  handleNewCostCenterSuccess,
  isEditing,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <Label htmlFor="document_number" className="text-lg">Nº Doc. <span className="text-red-500">*</span></Label>
        <Input id="document_number" name="document_number" value={formData.document_number} onChange={handleInputChange} placeholder="Ex: 001/2025" className="bg-white/5 border-white/20 rounded-xl" required />
      </div>
      <div>
        <Label htmlFor="issue_date" className="text-lg">Emissão <span className="text-red-500">*</span></Label>
        <DateInput
          date={formData.issue_date}
          setDate={handleDateChange}
        />
      </div>
      <div className="md:col-span-2 relative z-10 flex items-end gap-2">
        <div className="flex-grow">
          <ClientOrManualInput
            labelText={entityLabel}
            selectedClientId={formData.pessoa_id}
            onSelectClient={handleClientSelectId}
            clientName={formData.cliente_fornecedor_name}
            onClientNameChange={handleClientNameChange}
            clientFantasyName={formData.cliente_fornecedor_fantasy_name} // NEW: Pass fantasy name
            onClientFantasyNameChange={handleClientFantasyNameChange} // NEW: Pass fantasy name handler
            cnpjCpf={formData.cnpj_cpf}
            onCnpjCpfChange={handleCnpjCpfChange}
            refetchTrigger={clientListVersion}
          />
        </div>
        <Dialog open={isNewClientModalOpen} onOpenChange={setIsNewClientModalOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
              <PlusCircle className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto bg-gray-800 text-white border-gray-700 rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-emerald-300">Novo {entityLabel}</DialogTitle>
            </DialogHeader>
            <ClienteForm isModal onSaveSuccess={handleNewClientSuccess} personType={entityLabel.toLowerCase()} />
          </DialogContent>
        </Dialog>
      </div>
      <div>
        <Label htmlFor="cnpj_cpf" className="text-lg">CNPJ/CPF <span className="text-red-500">*</span></Label>
        <IMaskInput
          mask={[
            { mask: '000.000.000-00', maxLength: 11 },
            { mask: '00.000.000/0000-00' }
          ]}
          as={Input}
          id="cnpj_cpf"
          name="cnpj_cpf"
          value={formData.cnpj_cpf}
          onAccept={(value) => handleCnpjCpfChange(String(value))}
          placeholder="Digite o CNPJ ou CPF"
          className="w-full flex h-10 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm"
          disabled={!!formData.pessoa_id}
          required
        />
      </div>
      <div>
        <Label htmlFor="model" className="text-lg">Modelo</Label>
        <Select value={formData.model} onValueChange={(value) => handleSelectChange('model', value)}>
          <SelectTrigger className="bg-white/5 border-white/20 rounded-xl">
            <SelectValue placeholder="Selecione o modelo" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
            <SelectItem value="Recibo">Recibo</SelectItem>
            <SelectItem value="NF">Nota Fiscal</SelectItem>
            <SelectItem value="Fatura">Fatura</SelectItem>
            <SelectItem value="Outro">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="description" className="text-lg">Descrição <span className="text-red-500">*</span></Label>
        <Textarea id="description" name="description" value={formData.description} onChange={handleInputChange} placeholder="Descrição da obra / evento..." required className="bg-white/5 border-white/20 rounded-xl" />
      </div>
      <div>
        <Label htmlFor="payment_method" className="text-lg">Forma de Pagamento <span className="text-red-500">*</span></Label>
        <Select value={formData.payment_method} onValueChange={(value) => handleSelectChange('payment_method', value)}>
          <SelectTrigger className="bg-white/5 border-white/20 rounded-xl">
            <SelectValue placeholder="Selecione a forma de pagamento" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
            {paymentMethods.map(method => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-grow">
          <Label htmlFor="cost_center" className="text-lg">Centro de Custo</Label>
          <Select value={formData.cost_center} onValueChange={(value) => handleSelectChange('cost_center', value)}>
            <SelectTrigger className="bg-white/5 border-white/20 rounded-xl">
              <SelectValue placeholder="Selecione o centro de custo" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
              {costCenters.map(center => <SelectItem key={center.value} value={center.value}>{center.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={isNewCostCenterModalOpen} onOpenChange={setIsNewCostCenterModalOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
              <PlusCircle className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] bg-gray-800 text-white border-gray-700 rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-emerald-300">Novo Centro de Custo</DialogTitle>
            </DialogHeader>
            <CentroCustoForm isModal onSaveSuccess={handleNewCostCenterSuccess} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="total_value" className="text-lg">Valor Total (R$) <span className="text-red-500">*</span></Label>
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
          value={formData.total_value}
          onAccept={(value) => handleInputChange({ target: { name: 'total_value', value: value } })}
          placeholder="0,00"
          className="w-full flex h-10 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          required
        />
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="notes" className="text-lg">Referente / Observação</Label>
        <Textarea id="notes" name="notes" value={formData.notes} onChange={handleInputChange} placeholder="Informações adicionais..." className="bg-white/5 border-white/20 rounded-xl" />
      </div>
    </div>
  );
};