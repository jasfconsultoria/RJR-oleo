import React from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Eye, Trash2 } from 'lucide-react';

export const CertificadoActions = ({ onView, onDelete }) => (
  <div className="flex items-center gap-2">
    <Button variant="ghost" size="icon" onClick={onView}>
      <Eye className="h-4 w-4 text-blue-400" />
    </Button>
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
          <AlertDialogDescription className="text-emerald-300">
            Esta ação não pode ser desfeita. Isso excluirá permanentemente o certificado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" className="border-white/50 text-white hover:bg-white/20">Cancelar</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={onDelete} className="bg-red-600 hover:bg-red-700 text-white">Excluir</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
);