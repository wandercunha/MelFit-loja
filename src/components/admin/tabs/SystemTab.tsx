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

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordHash, setPasswordHash] = useState("");
  const [passwordCopied, setPasswordCopied] = useState(false);

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

  const generateHash = async () => {
    if (!newPassword) return;
    if (newPassword !== newPasswordConfirm) return;
    // SHA-256 via Web Crypto API (funciona no browser)
    const encoder = new TextEncoder();
    const data = encoder.encode(newPassword);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    setPasswordHash(hash);
  };

  const copyHash = () => {
    navigator.clipboard.writeText(passwordHash);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  const passwordsMatch = newPassword && newPassword === newPasswordConfirm;
  const passwordsMismatch = newPasswordConfirm && newPassword !== newPasswordConfirm;

  return (
    <div className="space-y-6 max-w-lg">
      <p className="text-sm text-gray-500">
        Configuracoes do sistema, credenciais e integracao.
      </p>

      {/* Login Atacado */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-5">
        <div>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Login Site Atacado (Flora Amar)
          </h4>
          <p className="text-xs text-gray-400 mt-1">
            Credenciais para scraping de precos e imagens. Salvas no navegador.
          </p>
        </div>

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
              className="input-field pr-16"
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

      {/* Save bar atacado */}
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

      {/* Trocar senha admin */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        <div>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Trocar Senha do Painel Admin
          </h4>
          <p className="text-xs text-gray-400 mt-1">
            Gere o codigo de seguranca aqui e depois configure no servidor.
          </p>
        </div>

        {!passwordHash ? (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Nova senha
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite a nova senha"
                className="input-field text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Confirmar nova senha
              </label>
              <input
                type="password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                placeholder="Repita a nova senha"
                className={`input-field text-sm ${passwordsMismatch ? "border-red-400" : ""}`}
              />
              {passwordsMismatch && (
                <p className="text-xs text-red-500 mt-1">As senhas nao conferem</p>
              )}
            </div>

            <button
              onClick={generateHash}
              disabled={!passwordsMatch}
              className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                passwordsMatch
                  ? "bg-brand-400 text-white hover:bg-brand-500"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Gerar Codigo de Seguranca
            </button>
          </>
        ) : (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-emerald-700">
                Codigo gerado com sucesso!
              </p>
              <p className="text-xs text-emerald-600">
                Copie o codigo abaixo e siga as instrucoes:
              </p>

              <div className="bg-white rounded-lg p-2 border border-emerald-300">
                <code className="text-[10px] font-mono text-gray-700 break-all select-all block">
                  {passwordHash}
                </code>
              </div>

              <button
                onClick={copyHash}
                className="w-full py-2 bg-emerald-500 text-white rounded-lg font-semibold text-sm hover:bg-emerald-600 transition-colors"
              >
                {passwordCopied ? "Copiado!" : "Copiar Codigo"}
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-bold text-blue-700">
                Agora configure no servidor:
              </p>

              <div className="space-y-3 text-xs text-blue-600">
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <p className="font-bold text-blue-700 mb-1">Opcao 1: Rodando local (seu computador)</p>
                  <p>Abra o terminal na pasta do projeto e rode:</p>
                  <code className="block bg-blue-50 rounded px-2 py-1.5 mt-1 font-mono text-[10px] text-gray-700">
                    npm run admin:reset -- {newPassword}
                  </code>
                  <p className="mt-1">Depois reinicie: <code className="bg-blue-50 px-1 rounded">npm run dev</code></p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <p className="font-bold text-blue-700 mb-1">Opcao 2: Na Vercel (producao)</p>
                  <ol className="list-decimal ml-4 space-y-1">
                    <li>Abra o painel da Vercel do seu projeto</li>
                    <li>Va em <strong>Settings</strong> &gt; <strong>Environment Variables</strong></li>
                    <li>Adicione uma nova variavel:</li>
                  </ol>
                  <div className="mt-1.5 bg-blue-50 rounded px-2 py-1.5 font-mono text-[10px] text-gray-700">
                    <p>Nome: <strong>ADMIN_PASSWORD_HASH</strong></p>
                    <p>Valor: <strong className="break-all">{passwordHash}</strong></p>
                  </div>
                  <ol className="list-decimal ml-4 mt-1.5" start={4}>
                    <li>Clique em <strong>Save</strong></li>
                    <li>Va em <strong>Deployments</strong> &gt; clique nos 3 pontinhos do deploy atual &gt; <strong>Redeploy</strong></li>
                  </ol>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setPasswordHash("");
                setNewPassword("");
                setNewPasswordConfirm("");
              }}
              className="w-full py-2 text-xs text-gray-400 hover:text-gray-600"
            >
              Voltar
            </button>
          </>
        )}
      </div>

      {/* Recovery info */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-red-600 mb-1">Perdeu o acesso ao admin?</p>
        <p className="text-xs text-red-500">
          A senha nao fica no banco de dados. Para recuperar, basta repetir
          o processo acima gerando um novo codigo e configurando no servidor.
          Se estiver na Vercel, qualquer pessoa com acesso ao painel da Vercel
          pode redefinir.
        </p>
      </div>
    </div>
  );
}
