import React from "react";
import AbrirContratoPDFButton from "@/components/AbrirContratoPDFButton";
// ... outros imports

const ListaContratos = ({ contratos }) => {
  // ... outros códigos e estados

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <span className="text-emerald-100">
          <i className="lucide lucide-file-text" />
        </span>
        Lista de Contratos
      </h1>
      <p className="mb-4 text-emerald-100/80">Gerencie os contratos de prestação de serviços.</p>

      {/* Filtros e busca aqui... */}

      <div className="overflow-x-auto rounded-lg bg-white/5">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-emerald-100/80">
              <th className="px-4 py-2">Nº Contrato</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Início</th>
              <th className="px-4 py-2">Fim</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {contratos.map((contrato) => (
              <tr key={contrato.id} className="border-b border-emerald-900/30 hover:bg-emerald-900/10">
                <td className="px-4 py-2">{contrato.numero_contrato}</td>
                <td className="px-4 py-2">{contrato.cliente_nome}</td>
                <td className="px-4 py-2">{contrato.data_inicio}</td>
                <td className="px-4 py-2">{contrato.data_fim}</td>
                <td className="px-4 py-2">
                  {contrato.status === "Ativo" ? (
                    <span className="bg-emerald-600/80 text-white px-3 py-1 rounded-full text-xs">Ativo</span>
                  ) : (
                    <span className="bg-blue-600/30 text-blue-100 px-3 py-1 rounded-full text-xs">
                      {contrato.status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 flex gap-2 items-center">
                  {/* Botão Abrir PDF */}
                  <AbrirContratoPDFButton contrato={contrato} />
                  {/* Outros botões/ações, se houver */}
                  {/* ... */}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ListaContratos;