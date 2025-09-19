import React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Contrato = {
  status: string;
  numero_contrato: string;
  pdf_url?: string;
  arquivo_assinado_url?: string;
};

interface AbrirContratoPDFButtonProps {
  contrato: Contrato;
}

const AbrirContratoPDFButton: React.FC<AbrirContratoPDFButtonProps> = ({ contrato }) => {
  const handleAbrirPDF = async () => {
    if (!contrato) {
      toast.error("Contrato não encontrado.");
      return;
    }

    // Normaliza status para minúsculo
    const status = contrato.status?.toLowerCase();

    // Nomes dos arquivos
    const nomeBase = `Contrato_${contrato.numero_contrato}`;
    const nomeAssinado = `${nomeBase}_assinado.pdf`;
    const nomeNaoAssinado = `${nomeBase}.pdf`;

    if (status === "ativo" && contrato.arquivo_assinado_url) {
      // Abre o PDF assinado
      window.open(contrato.arquivo_assinado_url, "_blank");
    } else if (status === "aguardando assinatura" && contrato.pdf_url) {
      // Abre o PDF não assinado
      window.open(contrato.pdf_url, "_blank");
    } else if (status === "aguardando assinatura") {
      // Se não existe PDF pronto, gera um novo com a mesma formatação do assinado
      try {
        // Exemplo de geração de PDF consistente (ajuste conforme seu template)
        const doc = new jsPDF({
          format: "a4",
          unit: "pt"
        });

        // Fonte e margens iguais ao assinado
        doc.setFont("times", "normal");
        doc.setFontSize(12);

        // Cabeçalho
        doc.text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS", 40, 60);

        // Corpo do contrato (exemplo)
        doc.text(`Número: ${contrato.numero_contrato}`, 40, 100);
        doc.text("Status: Aguardando Assinatura", 40, 120);

        // ...adicione aqui o restante do conteúdo do contrato...

        // Rodapé
        doc.text("RJR Óleo - Todos os direitos reservados", 40, 800);

        doc.save(nomeNaoAssinado);
        toast.success("PDF gerado com sucesso!");
      } catch (err) {
        toast.error("Erro ao gerar PDF.");
      }
    } else {
      toast.error("Status do contrato ou arquivos não encontrados.");
    }
  };

  return (
    <Button variant="outline" onClick={handleAbrirPDF}>
      Abrir PDF
    </Button>
  );
};

export default AbrirContratoPDFButton;