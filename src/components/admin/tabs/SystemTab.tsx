"use client";

import { useState } from "react";
import { useCatalog } from "@/context/CatalogContext";

export function SystemTab() {
  const { globalSettings, setGlobalSettings } = useCatalog();
  const [draft, setDraft] = useState({
    atacadoEmail: globalSettings.atacadoEmail,
    atacadoPassword: globalSettings.atacadoPassword,
  });
  const [saved, setSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const hasChanges =
    draft.atacadoEmail !== globalSettings.atacadoEmail ||
    draft.atacadoPassword !== globalSettings.atacadoPassword;

  const handleSave = () => {
    setGlobalSettings({ ...globalSettings, ...draft });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDiscard = () => {
    setDraft({
      atacadoEmail: globalSettings.atacadoEmail,
      atacadoPassword: globalSettings.atacadoPassword,
    });
  };

  return (
    <div className="space-y-6 max-w-lg">
      <p className="text-sm text-gray-500">
        Configuracoes do sistema, credenciais de acesso e integracao.
      </p>

      {/* Login Atacado */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-5">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
          Login Site Atacado (Flora Amar)
        </h4>
        <p className="text-xs text-gray-400 -mt-3">
          Credenciais para scraping autenticado de precos e imagens.
          Salvas localmente no navegador.
        </p>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={draft.atacadoEmail}
            onChange={(e) => setDraft({ ...draft, atacadoEmail: e.target.value })}
            placeholder="seu-email@exemplo.com"
            className="input-field"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Senha
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={draft.atacadoPassword}
              onChange={(e) => setDraft({ ...draft, atacadoPassword: e.target.value })}
              placeholder="••••••••"
              className="input-field pr-12"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-semibold"
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>
      </div>

      {/* Admin password */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
          Senha do Painel Admin
        </h4>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-700">Como trocar a senha</p>
          <div className="text-xs text-amber-600 space-y-1.5">
            <p>1. Escolha sua nova senha</p>
            <p>2. Gere o hash SHA-256 em qualquer um destes sites:</p>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>
                <a href="https://emn178.github.io/online-tools/sha256.html" target="_blank" rel="noopener noreferrer" className="underline">
                  emn178.github.io/online-tools/sha256
                </a>
              </li>
              <li>
                <a href="https://coding.tools/sha256" target="_blank" rel="noopener noreferrer" className="underline">
                  coding.tools/sha256
                </a>
              </li>
            </ul>
            <p>3. Cole o hash gerado como valor da variavel:</p>
            <code className="block bg-white rounded px-2 py-1 text-[10px] font-mono text-gray-700 break-all">
              ADMIN_PASSWORD_HASH=cole_o_hash_aqui
            </code>
          </div>
        </div>

        <div className="text-xs text-gray-500 space-y-2">
          <p className="font-semibold">Onde configurar:</p>
          <div className="space-y-1.5">
            <p>
              <span className="font-semibold text-gray-700">Local:</span>{" "}
              No arquivo <code className="bg-gray-200 px-1 rounded">.env.local</code> na raiz do projeto, ou rode:
            </p>
            <code className="block bg-gray-100 rounded px-2 py-1 font-mono text-[10px]">
              npm run admin:reset -- sua-nova-senha
            </code>
            <p>
              <span className="font-semibold text-gray-700">Vercel:</span>{" "}
              Settings &gt; Environment Variables &gt; adicione <code className="bg-gray-200 px-1 rounded">ADMIN_PASSWORD_HASH</code> com o hash gerado.
              Depois clique em Redeploy.
            </p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-600">
            <span className="font-semibold">Perdeu a senha?</span>{" "}
            Gere um novo hash e configure a variavel acima.
            Nao precisa acessar o banco — a senha fica na variavel de ambiente, nao no SQLite.
          </p>
        </div>
      </div>

      {/* Save bar */}
      {hasChanges && (
        <div className="flex gap-3 items-center bg-amber-50 border border-amber-200 rounded-xl p-4">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-amber-700 flex-1">Alteracoes nao salvas</p>
          <button onClick={handleDiscard} className="text-xs font-semibold px-3 py-1.5 text-gray-500 bg-white rounded-lg border hover:bg-gray-50">
            Descartar
          </button>
          <button onClick={handleSave} className="text-xs font-semibold px-4 py-1.5 bg-brand-400 text-white rounded-lg hover:bg-brand-500">
            Salvar
          </button>
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Configuracoes salvas!
        </div>
      )}
    </div>
  );
}
