// hooks/useAutoSave2.js
import { useState, useEffect, useCallback } from 'react';

export const useAutoSave2 = (key, initialValue) => {
  console.log(`🔄 useAutoSave2 iniciando - key: ${key}`);
  
  const [state, setState] = useState(() => {
    console.log('📦 Inicializando estado...');
    
    // Para novas entradas, sempre verificar localStorage primeiro
    let valueToUse = initialValue;
    
    if (typeof window !== 'undefined') {
      try {
        const item = window.localStorage.getItem(key);
        console.log('📋 Item do localStorage:', item);
        
        if (item && item !== 'undefined' && item !== 'null' && item !== '{}') {
          const parsed = JSON.parse(item);
          console.log('✅ Dados parseados do auto-save:', parsed);
          
          // Fazer merge seguro mantendo a estrutura do initialValue
          valueToUse = {
            ...initialValue,
            ...parsed,
            // Garantir que arrays importantes existam e tenham a estrutura correta
            itens: parsed.itens && Array.isArray(parsed.itens) && parsed.itens.length > 0 
              ? parsed.itens.map(item => ({
                  id: item.id || null,
                  produto_id: item.produto_id || null,
                  produto_nome: item.produto_nome || '',
                  unidade: item.unidade || '',
                  quantidade: item.quantidade || '',
                  tipo: item.tipo || '',
                  codigo: item.codigo || ''
                }))
              : initialValue.itens
          };
          
          console.log('🎯 Estado após merge:', valueToUse);
        } else {
          console.log('❌ Nenhum dado válido no auto-save, usando initialValue');
        }
      } catch (error) {
        console.error(`❌ Erro ao carregar auto-save para "${key}":`, error);
        // Em caso de erro, usar initialValue e limpar localStorage corrompido
        try {
          window.localStorage.removeItem(key);
        } catch (e) {
          // Ignorar erro na remoção
        }
        valueToUse = initialValue;
      }
    }
    
    return valueToUse;
  });

  const setValue = useCallback((value) => {
    console.log('✏️ Setando valor...');
    
    setState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      
      // Salvar no localStorage de forma segura
      if (typeof window !== 'undefined') {
        try {
          // Verificar se há dados válidos para salvar
          const hasValidData = newValue && (
            newValue.document_number !== '' || 
            newValue.cliente_id !== null || 
            newValue.observacao !== '' || 
            (newValue.itens && newValue.itens.some(item => 
              item.produto_id !== null || item.quantidade !== ''
            ))
          );
          
          if (hasValidData) {
            window.localStorage.setItem(key, JSON.stringify(newValue));
            console.log('💾 Auto-save salvo com sucesso');
          } else {
            window.localStorage.removeItem(key);
            console.log('🧹 Dados vazios - auto-save removido');
          }
        } catch (error) {
          console.error(`❌ Erro ao salvar auto-save para "${key}":`, error);
        }
      }
      
      return newValue;
    });
  }, [key]);

  const clearSavedData = useCallback(() => {
    console.log('🧹 Limpando auto-save...');
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(key);
        console.log('✅ Auto-save limpo');
      } catch (error) {
        console.error(`❌ Erro ao limpar auto-save para "${key}":`, error);
      }
    }
  }, [key]);

  return [state, setValue, clearSavedData];
};