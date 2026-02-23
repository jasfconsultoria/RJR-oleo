import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Hook para buscar estados e municípios da tabela municipios
 * @returns {Object} { estados, getMunicipios, loading, error }
 */
export const useLocationData = () => {
  const [estados, setEstados] = useState([]);
  const [municipiosMap, setMunicipiosMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const municipiosCacheRef = useRef({});

  // Buscar todos os estados únicos
  const fetchEstados = useCallback(async () => {
    try {
      // Lista completa de estados do Brasil (27 estados + DF)
      const todosEstados = [
        { value: 'AC', label: 'Acre' },
        { value: 'AL', label: 'Alagoas' },
        { value: 'AP', label: 'Amapá' },
        { value: 'AM', label: 'Amazonas' },
        { value: 'BA', label: 'Bahia' },
        { value: 'CE', label: 'Ceará' },
        { value: 'DF', label: 'Distrito Federal' },
        { value: 'ES', label: 'Espírito Santo' },
        { value: 'GO', label: 'Goiás' },
        { value: 'MA', label: 'Maranhão' },
        { value: 'MT', label: 'Mato Grosso' },
        { value: 'MS', label: 'Mato Grosso do Sul' },
        { value: 'MG', label: 'Minas Gerais' },
        { value: 'PA', label: 'Pará' },
        { value: 'PB', label: 'Paraíba' },
        { value: 'PR', label: 'Paraná' },
        { value: 'PE', label: 'Pernambuco' },
        { value: 'PI', label: 'Piauí' },
        { value: 'RJ', label: 'Rio de Janeiro' },
        { value: 'RN', label: 'Rio Grande do Norte' },
        { value: 'RS', label: 'Rio Grande do Sul' },
        { value: 'RO', label: 'Rondônia' },
        { value: 'RR', label: 'Roraima' },
        { value: 'SC', label: 'Santa Catarina' },
        { value: 'SP', label: 'São Paulo' },
        { value: 'SE', label: 'Sergipe' },
        { value: 'TO', label: 'Tocantins' }
      ];

      // Usar lista estática completa para garantir que todos os estados estejam sempre disponíveis
      setEstados(todosEstados);
    } catch (err) {
      console.error('Erro ao buscar estados:', err);
      setError(err);
    }
  }, []);

  // Buscar municípios por estado
  const fetchMunicipios = useCallback(async (uf) => {
    if (!uf) return [];

    // Verificar se já está no cache (usando ref para evitar dependências)
    if (municipiosCacheRef.current[uf]) {
      // Atualizar o estado se necessário (para componentes que dependem do estado)
      setMunicipiosMap(prev => {
        if (!prev[uf]) {
          return { ...prev, [uf]: municipiosCacheRef.current[uf] };
        }
        return prev;
      });
      return municipiosCacheRef.current[uf];
    }

    try {
      const { data, error: municipiosError } = await supabase
        .from('municipios')
        .select('municipio')
        .eq('uf', uf)
        .not('municipio', 'is', null)
        .order('municipio', { ascending: true });

      if (municipiosError) throw municipiosError;

      const municipios = (data || [])
        .map(item => item.municipio)
        .filter(Boolean)
        .sort();

      // Cachear os municípios no ref e no estado
      municipiosCacheRef.current[uf] = municipios;
      setMunicipiosMap(prev => ({
        ...prev,
        [uf]: municipios
      }));

      return municipios;
    } catch (err) {
      console.error(`Erro ao buscar municípios para ${uf}:`, err);
      return [];
    }
  }, []);

  // Função helper para obter municípios (compatível com a API antiga)
  const getMunicipios = useCallback((uf) => {
    return municipiosMap[uf] || [];
  }, [municipiosMap]);

  // Carregar estados na inicialização
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      await fetchEstados();
      setLoading(false);
    };
    loadData();
  }, [fetchEstados]);

  return {
    estados,
    getMunicipios,
    fetchMunicipios,
    loading,
    error
  };
};

