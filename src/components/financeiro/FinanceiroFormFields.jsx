import React, { useState, useEffect } from 'react';
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
  handleClientFantasyNameChange,
  handleCnpjCpfChange,
  costCenters,
  entityLabel,
  clientListVersion,
  isNewClientModalOpen, // Agora é uma prop
  setIsNewClientModalOpen, // Agora é uma prop
  isNewCostCenterModalOpen,
  setIsNewCostCenterModalOpen,
  handleNewClientSuccess,
  handleNewCostCenterSuccess,
  isEditing,
}) => {
  // Removido o estado interno isNewClientModalOpen e os useEffects de localStorage.
  // O estado agora é totalmente controlado pelo componente pai via props.

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Label htmlFor="document_number" className="text-sm">Nº Doc. <span className="text-red-500">*</span></Label>
        <Input id="document_number" name="document_number" value={formData.document_number} onChange={handleInputChange} placeholder="Ex: 001/2025" className="bg-white/5 border-white/20 rounded-xl h-9 text-xs" required />
      </div>
      <div>
        <Label htmlFor="issue_date" className="text-sm">Emissão <span className="text-red-500">*</span></Label>
        <DateInput
          date={formData.issue_date}
          setDate={handleDateChange}
          inputClassName="h-9 text-xs"
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
            clientFantasyName={formData.cliente_fornecedor_fantasy_name}
            onClientFantasyNameChange={handleClientFantasyNameChange}
            cnpjCpf={formData.cnpj_cpf}
            onCnpjCpfChange={handleCnpjCpfChange}
            refetchTrigger={clientListVersion}
            inputClassName="h-9 text-xs"
          />
        </div>
        <Dialog open={isNewClientModalOpen} onOpenChange={setIsNewClientModalOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
              <PlusCircle className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] bg-gray-800 text-white border-gray-700 rounded-xl">
            <DialogHeader>
              {/* <DialogTitle className="text-emerald-300">Novo {entityLabel}</DialogTitle> */}
            </DialogHeader>
            <ClienteForm 
              isModal 
              onSaveSuccess={handleNewClientSuccess} 
              personType={entityLabel.toLowerCase()} 
              onCancel={() => setIsNewClientModalOpen(false)} // Passa a função para fechar o modal
            />
          </DialogContent>
        </Dialog>
      </div>
      <div>
        <Label htmlFor="cnpj_cpf" className="text-sm">CNPJ/CPF <span className="text-red-500">*</span></Label>
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
          className="w-full flex h-9 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs"
          disabled={!!formData.pessoa_id}
          required
        />
      </div>
      <div>
        <Label htmlFor="model" className="text-sm">Modelo</Label>
        <Select value={formData.model} onValueChange={(value) => handleSelectChange('model', value)}>
          <SelectTrigger className="bg-white/5 border-white/20 rounded-xl h-9 text-xs">
            <SelectValue placeholder="Selecione o modelo" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl text-xs">
            <SelectItem value="Recibo">Recibo</SelectItem>
            <SelectItem value="NF">Nota Fiscal</SelectItem>
            <SelectItem value="Fatura">Fatura</SelectItem>
            <SelectItem value="Outro">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="description" className="text-sm">Descrição <span className="text-red-500">*</span></Label>
        <Textarea id="description" name="description" value={formData.description} onChange={handleInputChange} placeholder="Descrição da obra / evento..." required className="bg-white/5 border-white/20 rounded-xl h-9 text-xs" />
      </div>
      <div>
        <Label htmlFor="payment_method" className="text-sm">Forma de Pagamento <span className="text-red-500">*</span></Label>
        <Select value={formData.payment_method} onValueChange={(value) => handleSelectChange('payment_method', value)}>
          <SelectTrigger className="bg-white/5 border-white/20 rounded-xl h-9 text-xs">
            <SelectValue placeholder="Selecione a forma de pagamento" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl text-xs">
            {paymentMethods.map(method => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-grow">
          <Label htmlFor="cost_center" className="text-sm">Centro de Custo</Label>
          <Select value={formData.cost_center} onValueChange={(value) => handleSelectChange('cost_center', value)}>
            <SelectTrigger className="bg-white/5 border-white/20 rounded-xl h-9 text-xs">
              <SelectValue placeholder="Selecione o centro de custo" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl text-xs">
              {costCenters.map(center => <SelectItem key={center.value} value={center.value}>{center.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={isNewCostCenterModalOpen} onOpenChange={setIsNewCostCenterModalOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
              <PlusCircle className="h-4 w-4" />
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
        <Label htmlFor="total_value" className="text-sm">Valor Total (R$) <span className="text-red-500">*</span></Label>
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
          className="w-full flex h-9 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          required
          inputMode="numeric" // Adicionado para teclado numérico
          pattern="[0-9]*"    // Adicionado para teclado numérico
        />
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="notes" className="text-sm">Referente / Observação</Label>
        <Textarea id="notes" name="notes" value={formData.notes} onChange={handleInputChange} placeholder="Informações adicionais..." className="bg-white/5 border-white/20 rounded-xl h-9 text-xs" />
      </div>
    </div>
  );
};