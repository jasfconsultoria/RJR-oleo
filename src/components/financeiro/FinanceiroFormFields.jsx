import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle } from 'lucide-react';
import { IMaskInput } from 'react-imask';
import { DateInput } from '@/components/ui/date-input';
import ClienteSearchableSelect from '@/components/clientes/ClienteSearchableSelect';
import CentroCustoSearchableSelect from '@/components/centros-custo/CentroCustoSearchableSelect';
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ClienteForm from '@/pages/clientes/ClienteForm';
import CentroCustoForm from '@/pages/centros-custo/CentroCustoForm';
import { supabase } from '@/lib/customSupabaseClient';

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
  costCenterListVersion,
  isNewClientModalOpen,
  setIsNewClientModalOpen,
  isNewCostCenterModalOpen,
  setIsNewCostCenterModalOpen,
  handleNewClientSuccess,
  handleNewCostCenterSuccess,
  onDocumentValueChange,
  onDescontoChange,
  onInterestChange,
  isEditing,
  documentNumberRef,
}) => {
  // Garantir que a ref esteja disponível para uso no JSX
  const internalRef = documentNumberRef;

  // ✅ CORREÇÃO: Valores seguros para formData
  const safeFormData = {
    document_number: formData?.document_number || '',
    issue_date: formData?.issue_date || new Date(),
    model: formData?.model || 'Recibo',
    pessoa_id: formData?.pessoa_id || null,
    cliente_fornecedor_name: formData?.cliente_fornecedor_name || '',
    cliente_fornecedor_fantasy_name: formData?.cliente_fornecedor_fantasy_name || '',
    cnpj_cpf: formData?.cnpj_cpf || '',
    description: formData?.description || '',
    document_value: formData?.document_value ?? '',
    desconto_value: formData?.desconto_value ?? '',
    interest_value: formData?.interest_value ?? '',
    total_value: formData?.total_value ?? '',
    payment_method: formData?.payment_method || 'pix',
    cost_center: formData?.cost_center || '',
    notes: formData?.notes || '',
  };

  const safeCostCenters = Array.isArray(costCenters) ? costCenters : [];

  // ✅ CORREÇÃO SIMPLIFICADA: Usar returnFullClientData e receber objeto completo
  const handleClientSelect = (clientData) => {
    if (clientData && typeof clientData === 'object') {
      // Recebeu objeto completo do cliente (quando returnFullClientData=true)
      console.log('Dados completos do cliente:', clientData);

      // ✅ CORREÇÃO CRÍTICA: Usar razao_social em vez de nome
      handleClientSelectId(clientData.id);
      handleClientNameChange(clientData.razao_social || '');
      handleClientFantasyNameChange(clientData.nome_fantasia || '');
      handleCnpjCpfChange(clientData.cnpj_cpf || '');
    } else if (clientData === null) {
      // Limpando a seleção
      console.log('Limpando seleção do cliente');
      handleClientSelectId(null);
      handleClientNameChange('');
      handleClientFantasyNameChange('');
      handleCnpjCpfChange('');
    } else {
      // Comportamento antigo (apenas ID) - para compatibilidade
      handleClientSelectId(clientData);
    }
  };

  // ✅ CORREÇÃO: Função para lidar com mudança no termo de busca
  const handleSearchTermChange = (searchTerm) => {
    // Quando o usuário digita manualmente, atualizar o nome do cliente
    // mas só se não tiver um cliente selecionado e o termo não for o display concatenado
    if (searchTerm && !formData?.pessoa_id) {
      handleClientNameChange(searchTerm);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="flex-grow">
        <Label htmlFor="document_number" className="text-sm">Nº Doc. <span className="text-red-500">*</span></Label>
        <Input
          ref={internalRef}
          id="document_number"
          name="document_number"
          value={safeFormData.document_number}
          onChange={handleInputChange}
          placeholder="Ex: 001/2025"
          className="bg-white/5 border-white/20 rounded-xl h-9 text-xs"
          required
        />
      </div>
      <div>
        <Label htmlFor="issue_date" className="text-sm">Emissão <span className="text-red-500">*</span></Label>
        <DateInput
          date={safeFormData.issue_date}
          setDate={handleDateChange}
          className="h-9 text-xs"
        />
      </div>
      <div className="md:col-span-2 relative z-10 flex items-end gap-2">
        <div className="flex-grow">
          <ClienteSearchableSelect
            labelText={entityLabel}
            value={safeFormData.pessoa_id}
            onChange={handleClientSelect}
            searchTerm={safeFormData.cliente_fornecedor_name}
            onSearchTermChange={handleSearchTermChange}
            disabled={false}
            // ✅ CORREÇÃO: Passar o personType (cliente ou fornecedor)
            personType={entityLabel.toLowerCase() === 'fornecedor' ? 'fornecedor' : 'cliente'}
            // ✅ CORREÇÃO: Pedir os dados completos do cliente
            returnFullClientData={true}
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
              onCancel={() => setIsNewClientModalOpen(false)}
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
          value={safeFormData.cnpj_cpf}
          onAccept={(value) => handleCnpjCpfChange(String(value))}
          placeholder="Digite o CNPJ ou CPF"
          className="w-full flex h-9 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs"
          disabled={!!safeFormData.pessoa_id}
          inputMode="numeric"
          required
        />
      </div>
      <div>
        <Label htmlFor="model" className="text-sm">Modelo</Label>
        <Select value={safeFormData.model} onValueChange={(value) => handleSelectChange('model', value)}>
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
        <Textarea
          id="description"
          name="description"
          value={safeFormData.description}
          onChange={handleInputChange}
          placeholder="Descrição da obra / evento..."
          required
          className="bg-white/5 border-white/20 rounded-xl h-9 text-xs"
        />
      </div>
      <div className="md:col-span-2 grid grid-cols-5 gap-4">
        <div className="col-span-2">
          <Label htmlFor="payment_method" className="text-sm">Forma de Pagamento <span className="text-red-500">*</span></Label>
          <Select value={safeFormData.payment_method} onValueChange={(value) => handleSelectChange('payment_method', value)}>
            <SelectTrigger className="bg-white/5 border-white/20 rounded-xl h-9 text-xs">
              <SelectValue placeholder="Selecione a forma de pagamento" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl text-xs">
              {paymentMethods.map(method => (
                <SelectItem key={method.value} value={method.value}>
                  {method.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative z-10 flex items-end gap-2 col-span-3">
          <div className="flex-grow">
            <CentroCustoSearchableSelect
              labelText="Centro de Custo"
              value={safeFormData.cost_center}
              onChange={(value) => handleSelectChange('cost_center', value)}
              disabled={false}
              required={true}
              version={costCenterListVersion}
            />
          </div>
          <Dialog open={isNewCostCenterModalOpen} onOpenChange={setIsNewCostCenterModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
                <PlusCircle className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-gray-800 text-white border-gray-700 rounded-xl">
              <DialogHeader>
                {/* <DialogTitle className="text-emerald-300">Novo Centro de Custo</DialogTitle> */}
              </DialogHeader>
              <CentroCustoForm isModal onSaveSuccess={handleNewCostCenterSuccess} />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {/* Valor Documento + Valor Desconto + Valor Juros + Valor Total calculado */}
      <div className="md:col-span-2 grid grid-cols-4 gap-4">
        <div>
          <Label htmlFor="document_value" className="text-sm">Valor Documento (R$) <span className="text-red-500">*</span></Label>
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
            value={safeFormData.document_value}
            lazy={true}
            onAccept={(value) => onDocumentValueChange && onDocumentValueChange(value)}
            placeholder="0,00"
            className="w-full flex h-9 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs ring-offset-background placeholder:text-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 !text-right"
            required
            inputMode="decimal"
          />
        </div>
        <div>
          <Label htmlFor="desconto_value" className="text-sm">Valor Desconto (R$)</Label>
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
            value={safeFormData.desconto_value}
            lazy={true}
            onAccept={(value) => onDescontoChange && onDescontoChange(value)}
            placeholder="0,00"
            className="w-full flex h-9 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs ring-offset-background placeholder:text-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 !text-right"
            inputMode="decimal"
          />
        </div>
        <div>
          <Label htmlFor="interest_value" className="text-sm">Valor Juros (R$)</Label>
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
            value={safeFormData.interest_value}
            lazy={true}
            onAccept={(value) => onInterestChange && onInterestChange(value)}
            placeholder="0,00"
            className="w-full flex h-9 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs ring-offset-background placeholder:text-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 !text-right"
            inputMode="decimal"
          />
        </div>
        <div>
          <Label htmlFor="total_value" className="text-sm">Valor Total (R$)</Label>
          <Input
            id="total_value"
            name="total_value"
            value={safeFormData.total_value}
            disabled
            className="bg-white/5 border-white/20 rounded-xl h-9 text-xs opacity-70 cursor-not-allowed text-right"
            placeholder="Calculado"
          />
        </div>
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="notes" className="text-sm">Referente / Observação</Label>
        <Textarea
          id="notes"
          name="notes"
          value={safeFormData.notes}
          onChange={handleInputChange}
          placeholder="Informações adicionais..."
          className="bg-white/5 border-white/20 rounded-xl h-9 text-xs"
        />
      </div>
    </div>
  );
};