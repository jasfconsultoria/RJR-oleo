import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IMaskInput } from 'react-imask';

const UserFormFields = ({
  userFormData,
  isEditing,
  handleChange,
  handleRoleChange,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
      {/* Nome Completo */}
      <div className="md:col-span-6">
        <Label htmlFor="full_name" className="text-sm">Nome Completo <span className="text-red-400">*</span></Label>
        <Input
          id="full_name"
          name="full_name"
          value={userFormData.full_name}
          onChange={handleChange}
          placeholder="Nome completo do usuário"
          className="mt-1 bg-white/5 border-white/20 text-white placeholder:text-white/60 focus:border-emerald-400 rounded-xl h-9 text-xs"
        />
      </div>

      {/* Email */}
      <div className="md:col-span-6">
        <Label htmlFor="email" className="text-sm">Email <span className="text-red-400">*</span></Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={userFormData.email}
          onChange={handleChange}
          placeholder="email@exemplo.com"
          className="mt-1 bg-white/5 border-white/20 text-white placeholder:text-white/60 focus:border-emerald-400 rounded-xl h-9 text-xs"
        />
      </div>

      {/* CPF */}
      <div className="md:col-span-3">
        <Label htmlFor="cpf" className="text-sm">CPF</Label>
        <IMaskInput
          id="cpf"
          name="cpf"
          mask="000.000.000-00"
          value={userFormData.cpf || ''}
          onAccept={(value) => {
            const cleanedValue = value.replace(/\D/g, '');
            handleChange({ target: { name: 'cpf', value: cleanedValue } });
          }}
          placeholder="000.000.000-00"
          className="flex h-9 w-full rounded-xl border border-white/20 bg-white/5 px-3 py-1 text-xs text-white placeholder:text-white/60 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
        />
      </div>

      {/* Telefone */}
      <div className="md:col-span-3">
        <Label htmlFor="telefone" className="text-sm">Telefone</Label>
        <IMaskInput
          id="telefone"
          name="telefone"
          mask={[
            { mask: '(00) 0000-0000' }, // Telefone fixo
            { mask: '(00) 00000-0000' } // Celular
          ]}
          value={userFormData.telefone || ''}
          onAccept={(value) => {
            const cleanedValue = value.replace(/\D/g, '');
            handleChange({ target: { name: 'telefone', value: cleanedValue } });
          }}
          placeholder="(00) 00000-0000"
          className="flex h-9 w-full rounded-xl border border-white/20 bg-white/5 px-3 py-1 text-xs text-white placeholder:text-white/60 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
        />
      </div>

      {/* Senha */}
      <div className="md:col-span-3">
        <Label htmlFor="password" className="text-sm">
          Senha {isEditing ? '(Deixe em branco para não alterar)' : <span className="text-red-400">*</span>}
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          value={userFormData.password}
          onChange={handleChange}
          className="mt-1 bg-white/5 border-white/20 text-white placeholder:text-white/60 focus:border-emerald-400 rounded-xl h-9 text-xs"
        />
      </div>

      {/* Perfil do Usuário */}
      <div className="md:col-span-3">
        <Label htmlFor="role" className="text-sm">Perfil do Usuário <span className="text-red-400">*</span></Label>
        <Select onValueChange={handleRoleChange} value={userFormData.role}>
          <SelectTrigger className="mt-1 bg-white/5 border-white/20 text-white focus:ring-emerald-400 rounded-xl h-9 text-xs">
            <SelectValue placeholder="Selecione o perfil" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
            <SelectItem value="coletor">Coletor</SelectItem>
            <SelectItem value="administrador">Administrador</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div className="md:col-span-3">
        <Label htmlFor="status" className="text-sm">Status <span className="text-red-400">*</span></Label>
        <Select 
          onValueChange={(value) => {
            const event = { target: { name: 'status', value } };
            handleChange(event);
          }} 
          value={userFormData.status || 'ativo'}
        >
          <SelectTrigger className="mt-1 bg-white/5 border-white/20 text-white focus:ring-emerald-400 rounded-xl h-9 text-xs">
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default UserFormFields;