import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export const UserSearchableSelect = ({ value, onChange, users, disabled = false, loading = false, labelText = "Usuário" }) => {
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const selectedUser = users.find(u => u.id === value);
    setInputValue(selectedUser ? selectedUser.full_name : '');
  }, [value, users]);

  const filteredUsers = useMemo(() => {
    if (!inputValue) {
      return users;
    }
    return users.filter(user =>
      user.full_name.toLowerCase().includes(inputValue.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(inputValue.toLowerCase()))
    );
  }, [inputValue, users]);

  const handleSelect = (user) => {
    onChange(user.id);
    setInputValue(user.full_name);
    setShowDropdown(false);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    if (!e.target.value) {
      onChange(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <Label className="block text-lg mb-2">{labelText}</Label>
      <div className="relative">
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setShowDropdown(true)}
          placeholder={loading ? "Carregando usuários..." : "Digite para buscar..."}
          className="bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
          autoComplete="off"
          disabled={disabled || loading}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />}
      </div>
      
      {showDropdown && !disabled && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-50 w-full bg-white rounded-xl shadow-lg max-h-60 overflow-y-auto mt-1"
        >
          {filteredUsers.length > 0 ? filteredUsers.map((user) => (
            <div
              key={user.id}
              onClick={() => handleSelect(user)}
              className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium text-gray-900">{user.full_name}</div>
              <div className="text-sm text-gray-600 capitalize">
                {user.role}
              </div>
            </div>
          )) : (
            <div className="p-3 text-center text-gray-500">
              {loading ? "Carregando..." : "Nenhum usuário encontrado."}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};