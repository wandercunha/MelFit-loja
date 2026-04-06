"use client";

import { useState, useEffect } from "react";
import { Product, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/types";

interface Props {
  product?: Product | null;  // null = novo produto
  onSave: (product: Product) => void;
  onClose: () => void;
}

export function ProductFormModal({ product, onSave, onClose }: Props) {
  const isEdit = !!product;

  const [name, setName] = useState(product?.name || "");
  const [cost, setCost] = useState(product?.cost || 0);
  const [category, setCategory] = useState(product?.category || "tops");
  const [sizes, setSizes] = useState(product?.sizes || "P, M, G");
  const [img, setImg] = useState(product?.img || "");
  const [description, setDescription] = useState(product?.description || "");
  const [showPreview, setShowPreview] = useState(false);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleSave = () => {
    if (!name.trim() || cost <= 0) return;
    onSave({
      id: product?.id || Date.now(),
      name: name.trim(),
      cost,
      category,
      tags: [],
      sizes,
      img: img.trim(),
      description: description.trim() || undefined,
      isCustom: true,
    });
  };

  // Todas as categorias disponíveis
  const categories = [
    ...CATEGORY_ORDER.map((slug) => ({ slug, label: CATEGORY_LABELS[slug] || slug })),
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-end lg:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl lg:rounded-2xl w-full lg:max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">
            {isEdit ? "Editar Produto" : "Novo Produto"}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-xl">
            &times;
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Nome */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Nome do Produto *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Top Speed Azul Marinho"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-400 focus:outline-none"
            />
          </div>

          {/* Custo + Categoria */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Custo (R$) *</label>
              <input
                type="text"
                inputMode="decimal"
                value={cost || ""}
                onChange={(e) => { const v = parseFloat(e.target.value); setCost(isNaN(v) ? 0 : v); }}
                onFocus={(e) => e.target.select()}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-right focus:border-brand-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-400 focus:outline-none bg-white"
              >
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tamanhos */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Tamanhos</label>
            <input
              type="text"
              value={sizes}
              onChange={(e) => setSizes(e.target.value)}
              placeholder="P, M, G, GG"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-400 focus:outline-none"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">Separados por virgula</p>
          </div>

          {/* Imagem URL */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">URL da Imagem</label>
            <input
              type="text"
              value={img}
              onChange={(e) => setImg(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-400 focus:outline-none"
            />
            {img && (
              <div className="mt-2 flex justify-center">
                <img
                  src={img}
                  alt="Preview"
                  className="w-24 h-24 object-cover rounded-lg border"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
          </div>

          {/* Descrição HTML */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-600">Descricao (aceita HTML)</label>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-[10px] font-bold text-brand-400 hover:text-brand-500"
              >
                {showPreview ? "Editar" : "Preview"}
              </button>
            </div>
            {showPreview ? (
              <div
                className="w-full min-h-[100px] px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: description || "<em>Sem descricao</em>" }}
              />
            ) : (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="<p>Descricao do produto...</p>&#10;<ul><li>Composicao: ...</li></ul>"
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:border-brand-400 focus:outline-none resize-y"
              />
            )}
            <p className="text-[10px] text-gray-400 mt-0.5">
              Texto puro ou HTML. Pode colar de qualquer fonte.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || cost <= 0}
            className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-brand-400 text-white hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isEdit ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}
