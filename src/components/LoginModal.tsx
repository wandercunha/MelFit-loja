"use client";

import { useCatalog } from "@/context/CatalogContext";
import { useState } from "react";

interface Props {
  onClose: () => void;
}

export function LoginModal({ onClose }: Props) {
  const { login } = useCatalog();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(user, pass)) {
      onClose();
    } else {
      setError("Usuário ou senha incorretos");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl"
      >
        <h2 className="text-2xl font-bold text-brand-500 text-center mb-6">
          Área Administrativa
        </h2>

        <input
          type="text"
          placeholder="Usuário"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          className="input-field mb-3"
          autoFocus
        />
        <input
          type="password"
          placeholder="Senha"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          className="input-field mb-4"
        />

        {error && (
          <p className="text-red-600 text-sm text-center mb-3">{error}</p>
        )}

        <button type="submit" className="btn-primary w-full">
          Entrar
        </button>

        <p className="text-xs text-gray-400 text-center mt-4">
          Padrão: admin / flora2024
        </p>
      </form>
    </div>
  );
}
