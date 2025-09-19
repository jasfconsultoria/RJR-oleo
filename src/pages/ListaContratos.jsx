import React from "react";
import { Button } from "@/components/ui/button";

const BASE_PDF_URL = "https://itegudxajerdxhnhlqat.supabase.co/storage/v1/object/public/contratos/";

function getPdfFileName(contrato) {
  // Exemplo: Contrato_CTR-2025-00049_assinado.pdf ou Contrato_CTR-2025-00049.pdf
  if (!contrato.numero_contrato) return null;
  if (contrato.status && contrato.status.toLowerCase() === "ativo") {
    return `Contrato_${contrato.numero_contrato}_assinado.pdf`;
  }
  if (contrato.status && contrato.status.toLowerCase() === "aguardando assinatura") {
    return `Contrato_${contrato.numero_contrato}.pdf`;
  }
  // Se quiser tratar outros status, adicione aqui
  return null;
}

const ListaContratos = ({ contratos }) => {
  const handleAbrirPdf = (contrato) => {
    const fileName = getPdfFileName(contrato);
    if (!fileName) {
      alert("Arquivo PDF não disponível para este contrato.");
      return;
    }
    const url = BASE_PDF_URL + fileName;
    window.open(url, "_blank");
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Lista de Contratos</h2>
      <table className="min-w-full bg-white border rounded shadow">
        <thead>
          <tr>
            <th className="px-4 py-2 border-b">Número</th>
            <th className="px-4 py-2 border-b">Status</th>
            <th className="px-4 py-2 border-b">Ações</th>
          </tr>
        </thead>
        <tbody>
          {contratos && contratos.length > 0 ? (
            contratos.map((contrato) => (
              <tr key={contrato.id}>
                <td className="px-4 py-2 border-b">{contrato.numero_contrato}</td>
                <td className="px-4 py-2 border-b capitalize">{contrato.status}</td>
                <td className="px-4 py-2 border-b">
                  <Button
                    variant="outline"
                    onClick={() => handleAbrirPdf(contrato)}
                  >
                    Abrir PDF
                  </Button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} className="text-center py-4">
                Nenhum contrato encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ListaContratos;