import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Copy, Share2 } from 'lucide-react';
import { QRCodeCanvas as QRCode } from 'qrcode.react';

const CertificadoViewModal = ({ certificado, isOpen, onClose }) => {
    const { toast } = useToast();

    if (!certificado) return null;

    const validationUrl = `${window.location.origin}/certificado/publico/${certificado.id}`;

    const handleCopy = () => {
        if (validationUrl) {
            navigator.clipboard.writeText(validationUrl);
            toast({ title: "Link Copiado!", description: "O link foi copiado para a área de transferência." });
        }
    };

    const handleShare = async () => {
        if (validationUrl) {
            const shareData = {
                title: `Certificado de Coleta - ${certificado.cliente.nome}`,
                text: `Acesse o certificado de coleta aqui:`,
                url: validationUrl,
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
                    <DialogTitle>Certificado: {certificado.id.substring(0, 8)}</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Compartilhe o link abaixo para validação e visualização do certificado.
                    </DialogDescription>
                </DialogHeader>
                
                {validationUrl ? (
                    <div className="flex flex-col items-center gap-4 my-4">
                        <div className="p-4 bg-white rounded-xl">
                            <QRCode value={validationUrl} size={160} />
                        </div>
                        <p className="text-sm text-gray-300 text-center break-all">{validationUrl}</p>
                    </div>
                ) : (
                    <p className="text-center text-yellow-400 my-4">
                        Não há link de validação para este certificado.
                    </p>
                )}

                <DialogFooter className="sm:justify-center gap-2">
                    {validationUrl && (
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

export default CertificadoViewModal;