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
      const { data, error: estadosError } = await supabase
        .from('municipios')
        .select('uf')
        .not('uf', 'is', null);

      if (estadosError) throw estadosError;

      // Obter estados únicos e ordenados
      const estadosUnicos = [...new Set(data.map(item => item.uf))]
        .filter(Boolean)
        .sort();

      // Mapear para o formato { value, label }
      const estadosFormatados = estadosUnicos.map(uf => {
        const estadoNames = {
          'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas',
          'BA': 'Bahia', 'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo',
          'GO': 'Goiás', 'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul',
          'MG': 'Minas Gerais', 'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná',
          'PE': 'Pernambuco', 'PI': 'Piauí', 'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte',
          'RS': 'Rio Grande do Sul', 'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina',
          'SP': 'São Paulo', 'SE': 'Sergipe', 'TO': 'Tocantins'
        };
        return {
          value: uf,
          label: estadoNames[uf] || uf
        };
      });

      setEstados(estadosFormatados);
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

