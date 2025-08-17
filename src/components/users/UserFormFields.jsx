import React, { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { estados, municipiosPorEstado } from '@/lib/location';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

const UserFormFields = ({
  userFormData,
  isEditing,
  handleChange,
  handleRoleChange,
  handleEstadoChange,
  handleMunicipioChange,
  selectedEstado
}) => {
  const municipioOptions = useMemo(() => {
    if (!selectedEstado) return [];
    return (municipiosPorEstado[selectedEstado] || []).map(m => ({ value: m, label: m }));
  }, [selectedEstado]);

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="full_name" className="text-lg">Nome Completo <span className="text-red-400">*</span></Label>
        <Input
          id="full_name"
          name="full_name"
          value={userFormData.full_name}
          onChange={handleChange}
          placeholder="Nome completo do usuário"
          className="mt-1 bg-white/5 border-white/20 text-white placeholder:text-white/60 focus:border-emerald-400 rounded-xl"
        />
      </div>

      <div>
        <Label htmlFor="email" className="text-lg">Email <span className="text-red-400">*</span></Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={userFormData.email}
          onChange={handleChange}
          placeholder="email@exemplo.com"
          className="mt-1 bg-white/5 border-white/20 text-white placeholder:text-white/60 focus:border-emerald-400 rounded-xl"
        />
      </div>

      <div>
        <Label htmlFor="password" className="text-lg">
          Senha {isEditing ? '(Deixe em branco para não alterar)' : <span className="text-red-400">*</span>}
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          value={userFormData.password}
          onChange={handleChange}
          className="mt-1 bg-white/5 border-white/20 text-white placeholder:text-white/60 focus:border-emerald-400 rounded-xl"
        />
      </div>

      <div>
        <Label htmlFor="role" className="text-lg">Perfil do Usuário <span className="text-red-400">*</span></Label>
        <Select onValueChange={handleRoleChange} value={userFormData.role}>
          <SelectTrigger className="mt-1 bg-white/5 border-white/20 text-white focus:ring-emerald-400 rounded-xl">
            <SelectValue placeholder="Selecione o perfil" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
            <SelectItem value="coletor">Coletor</SelectItem>
            <SelectItem value="administrador">Administrador</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {userFormData.role === 'coletor' && (
        <>
          <div>
            <Label htmlFor="estado" className="text-lg">Estado de Atuação</Label>
            <Select onValueChange={handleEstadoChange} value={selectedEstado}>
              <SelectTrigger className="mt-1 bg-white/5 border-white/20 text-white focus:ring-emerald-400 rounded-xl">
                <SelectValue placeholder="Selecione o Estado" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                {estados.map((estado) => (
                  <SelectItem key={estado.value} value={estado.value}>
                    {estado.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedEstado && (
            <div>
              <Label htmlFor="municipio" className="text-lg">Município de Atuação</Label>
              <div className="mt-1">
                <SearchableSelect
                  options={municipioOptions}
                  value={userFormData.municipio}
                  onChange={handleMunicipioChange}
                  placeholder="Selecione o Município"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserFormFields;