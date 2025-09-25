import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Package, User, Tag, Info, ArrowDownSquare, ArrowUpSquare, FileText } from 'lucide-react'; // Import FileText icon
import { formatNumber } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table'; // Import TableHead

const MovimentacaoViewDialog = ({ isOpen, onClose, movimentacao }) => {
  if (!movimentacao) return null;

  const getMovementIcon = (type) => {
    return type === 'entrada' ? <ArrowDownSquare className="h-5 w-5 text-green-400" /> : <ArrowUpSquare className="h-5 w-5 text-red-400" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-emerald-900 border-emerald-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getMovementIcon(movimentacao.tipo)} Detalhes da Movimentação de {movimentacao.tipo === 'entrada' ? 'Entrada' : 'Saída'}
          </DialogTitle>
          <DialogDescription className="text-emerald-300">
            Visualizando os detalhes da movimentação registrada em {format(parseISO(movimentacao.data), 'dd/MM/yyyy HH:mm', { locale: ptBR })}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold">Nº Documento:</span> <span>{movimentacao.document_number || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold">Origem:</span> <span className="capitalize">{movimentacao.origem}</span>
            </div>
            {movimentacao.cliente?.nome && (
              <div className="flex items-center gap-2 col-span-full sm:col-span-1">
                <User className="h-4 w-4 text-emerald-400" />
                <span className="font-semibold">Cliente:</span> {movimentacao.cliente.nome}
              </div>
            )}
            <div className="col-span-full flex items-start gap-2">
              <Info className="h-4 w-4 text-emerald-400 mt-1" />
              <span className="font-semibold">Observação:</span> <span className="flex-1">{movimentacao.observacao || 'N/A'}</span>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-white flex items-center gap-2 pt-4 border-t border-white/20">
            <Package className="h-5 w-5 text-emerald-400" /> Itens da Movimentação
          </h3>
          <div className="overflow-x-auto rounded-xl border border-white/20">
            <Table className="responsive-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
                  <TableHead className="text-white">Produto</TableHead>
                  <TableHead className="text-white">Código</TableHead>
                  <TableHead className="text-white text-right">Quantidade</TableHead>
                  <TableHead className="text-white text-center">Unidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentacao.itens_entrada_saida.length > 0 ? (
                  movimentacao.itens_entrada_saida.map((item, index) => (
                    <TableRow key={index} className="border-b-0 md:border-b border-white/10 text-white/90 text-sm">
                      <TableCell data-label="Produto" className="font-medium">{item.produto.nome}</TableCell>
                      <TableCell data-label="Código" className="font-mono">{item.produto.codigo || 'N/A'}</TableCell>
                      <TableCell data-label="Quantidade" className="text-right">{formatNumber(item.quantidade)}</TableCell>
                      <TableCell data-label="Unidade" className="text-center">{item.produto.unidade}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-4">Nenhum item.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MovimentacaoViewDialog;