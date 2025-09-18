import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Copy, Share2 } from 'lucide-react';
import { QRCodeCanvas as QRCode } from 'qrcode.react';

const ContratoViewModal = ({ contrato, isOpen, onClose }) => {
    const { toast } = useToast();

    if (!contrato) return null;

    const getLink = () => {
        if (contrato.status === 'Aguardando Assinatura') {
            return `${window.location.origin}/assinatura/${contrato.id}`;
        }
        if (contrato.status === 'Ativo') {
            return `${window.location.origin}/contrato-assinado/${contrato.id}`;
        }
        return null;
    };

    const link = getLink();

    const handleCopy = () => {
        if (link) {
            navigator.clipboard.writeText(link);
            toast({ title: "Link Copiado!", description: "O link foi copiado para a área de transferência." });
        }
    };

    const handleShare = async () => {
        if (link) {
            const shareData = {
                title: `Contrato ${contrato.numero_contrato}`,
                text: `Acesse o contrato aqui:`,
                url: link,
            };
            try {
                if (navigator.share) {
                    await navigator.share(shareData);
                } else {
                    handleCopy();
                }
            } catch (error) {
                console.error('Erro ao compartilhar:', error);
                handleCopy();
            }
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md rounded-xl">
                <DialogHeader>
                    <DialogTitle>Contrato: {contrato.numero_contrato}</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        {contrato.status === 'Aguardando Assinatura' 
                            ? 'Compartilhe o link abaixo para assinatura.'
                            : 'Contrato ativo. Compartilhe o link de visualização.'
                        }
                    </DialogDescription>
                </DialogHeader>
                
                {link ? (
                    <div className="flex flex-col items-center gap-4 my-4">
                        <div className="p-4 bg-white rounded-xl">
                            <QRCode value={link} size={160} />
                        </div>
                        <p className="text-sm text-gray-300 text-center break-all">{link}</p>
                    </div>
                ) : (
                    <p className="text-center text-yellow-400 my-4">
                        Não há link de compartilhamento para contratos com status "{contrato.status}".
                    </p>
                )}

                <DialogFooter className="sm:justify-center gap-2">
                    {link && (
                        <>
                            <Button onClick={handleCopy} variant="outline" className="w-full sm:w-auto">
                                <Copy className="mr-2 h-4 w-4" /> Copiar Link
                            </Button>
                            <Button onClick={handleShare} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700">
                                <Share2 className="mr-2 h-4 w-4" /> Compartilhar
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ContratoViewModal;