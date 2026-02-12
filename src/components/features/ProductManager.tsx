import React, { useState, useRef, useEffect } from 'react';
import { useRestaurantStore } from '../../stores/restaurantStore';
import { useProducts } from '../../hooks/useProducts';
import { Product, VariationGroupTemplate } from '../../types';
import { 
  PlusCircle, 
  Edit2, 
  Trash2, 
  X, 
  Upload, 
  Star,
  Image as ImageIcon,
  Settings 
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import ExtrasManager from './ExtrasManager';
import VariationsManager from './VariationsManager'; // NOVO!
import { compressImage } from '../../utils/imageCompression';

const ProductManager: React.FC = () => {
  const { currentRestaurant, categories } = useRestaurantStore();
  const { products, saveProduct, removeProduct } = useProducts();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [selectedProductForExtras, setSelectedProductForExtras] = useState<Product | null>(null);
  const [selectedProductForVariations, setSelectedProductForVariations] = useState<Product | null>(null); // NOVO!
  const [availableTemplates, setAvailableTemplates] = useState<VariationGroupTemplate[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const productImageRef = useRef<HTMLInputElement>(null);

  // Buscar templates ao carregar e sempre que o modal abrir
  const fetchTemplates = async () => {
    if (!currentRestaurant) return;
    const { data } = await supabase
      .from('variation_group_templates')
      .select('*, variation_option_templates(*)')
      .eq('restaurant_id', currentRestaurant.id)
      .order('display_order');
    
    if (data) setAvailableTemplates(data);
  };

  useEffect(() => {
    if (isModalOpen) {
      fetchTemplates();
    }
  }, [isModalOpen, currentRestaurant]);

  // Se editando produto, buscar templates já vinculados
  useEffect(() => {
    if (formData.id) {
      const fetchAssignments = async () => {
        const { data } = await supabase
          .from('product_variation_assignments')
          .select('template_group_id')
          .eq('product_id', formData.id);
        
        if (data) {
          setSelectedTemplates(data.map(a => a.template_group_id));
        }
      };
      
      fetchAssignments();
    } else {
      setSelectedTemplates([]);
    }
  }, [formData.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentRestaurant) return;

    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Imagem muito grande! Máximo 5MB');
      return;
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem válida');
      return;
    }

    try {
      // Comprimir imagem antes de subir usando o novo utilitário
      const compressedFile = await compressImage(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1200,
        quality: 0.85,
        format: 'webp'
      });
      
      const fileExt = 'webp';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${currentRestaurant.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, compressedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        alert('Erro ao fazer upload da imagem');
        console.error(uploadError);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      setFormData({ ...formData, image: publicUrl });
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao processar imagem');
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await saveProduct(formData as any);
    
    if (result.success && (result as any).data) {
      const productId = (result as any).data.id;
      // Deletar assignments antigos
      await supabase
        .from('product_variation_assignments')
        .delete()
        .eq('product_id', productId);
      
      // Inserir novos
      if (selectedTemplates.length > 0) {
        const assignments = selectedTemplates.map((templateId, index) => ({
          product_id: productId,
          template_group_id: templateId,
          display_order: index
        }));
        
        await supabase
          .from('product_variation_assignments')
          .insert(assignments);
      }

      setIsModalOpen(false);
      setFormData({});
      setSelectedTemplates([]);
    }
  };

  const handleDelete = async (id: string) => {
    await removeProduct(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-white">Produtos</h2>
        <button
          onClick={() => {
            setFormData({
              name: '',
              description: '',
              price: 0,
              is_available: true,
              is_promotion: false,
              category_id: categories[0]?.id || '',
            });
            setIsModalOpen(true);
          }}
          className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center hover:bg-orange-600 transition-all shadow-lg"
        >
          <PlusCircle size={18} className="mr-2" /> Novo Produto
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.length === 0 ? (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-white/10 rounded-3xl text-gray-500 font-bold">
            Nenhum produto cadastrado.
          </div>
        ) : (
          products.map((p) => (
            <div
              key={p.id}
              className="bg-[#2a2a2a] rounded-3xl border border-white/5 overflow-hidden group shadow-sm hover:shadow-xl transition-all relative"
            >
              {p.is_promotion && (
                <div className="absolute top-4 left-4 z-10 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-black shadow-md flex items-center">
                  <Star size={12} className="mr-1 fill-current" /> PROMO
                </div>
              )}
              <div className="h-48 overflow-hidden relative bg-[#1a1a1a]">
                {p.image ? (
                  <img
                    src={`${p.image}?width=400&height=400&resize=cover`}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    alt={p.name}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600">
                    <ImageIcon size={48} />
                  </div>
                )}
                <div className="absolute top-4 right-4 flex space-x-2">
                  <button
                    onClick={() => {
                      setFormData(p);
                      setIsModalOpen(true);
                    }}
                    className="p-2 bg-[#2a2a2a] rounded-xl shadow-md text-gray-400 hover:text-white hover:bg-white/10"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-2 bg-[#2a2a2a] rounded-xl shadow-md text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-lg text-white">{p.name}</h4>
                  <span className="font-black text-orange-500">
                    R$ {Number(p.price).toFixed(2)}
                  </span>
                </div>
                <p className="text-gray-400 text-sm line-clamp-2 mb-4">{p.description}</p>
                
                {/* NOVO: Botões de Gerenciamento */}
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedProductForVariations(p)}
                    className="w-full bg-orange-500/10 border border-orange-500/30 text-orange-400 px-4 py-2 rounded-xl font-bold flex items-center justify-center hover:bg-orange-500/20 transition-all"
                  >
                    <Settings size={16} className="mr-2" />
                    Variações (Tamanhos)
                  </button>
                  
                  <button
                    onClick={() => setSelectedProductForExtras(p)}
                    className="w-full bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-xl font-bold flex items-center justify-center hover:bg-amber-500/20 transition-all"
                  >
                    <PlusCircle size={16} className="mr-2" />
                    Adicionais
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-[#1a1a1a] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-white/10"
          >
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#2a2a2a]">
              <h3 className="text-xl font-bold uppercase tracking-tight text-white">
                {formData.id ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div
                className="relative h-48 rounded-2xl overflow-hidden border-2 border-dashed border-white/10 flex items-center justify-center bg-[#2a2a2a] group cursor-pointer"
                onClick={() => productImageRef.current?.click()}
              >
                {formData.image ? (
                  <img
                    src={formData.image}
                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                    alt="Preview"
                  />
                ) : (
                  <div className="text-center">
                    <Upload className="mx-auto text-gray-600" size={32} />
                    <p className="text-xs text-gray-500 font-bold mt-2 uppercase">
                      Subir Foto
                    </p>
                  </div>
                )}
                <input
                  type="file"
                  ref={productImageRef}
                  hidden
                  accept="image/*"
                  onChange={handleFileUpload}
                />
              </div>

              <label className="block">
                <span className="text-xs font-bold text-gray-400 uppercase ml-1">Nome</span>
                <input
                  type="text"
                  required
                  className="mt-1 w-full p-4 bg-[#2a2a2a] border border-white/5 rounded-2xl font-bold outline-none focus:border-white/10 text-white placeholder:text-gray-600"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold text-gray-400 uppercase ml-1">Descrição</span>
                <textarea
                  className="mt-1 w-full p-4 bg-[#2a2a2a] border border-white/5 rounded-2xl h-24 resize-none font-medium outline-none focus:border-white/10 text-white placeholder:text-gray-600"
                  value={formData.description || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-bold text-gray-400 uppercase ml-1">Preço Base (R$)</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="mt-1 w-full p-4 bg-[#2a2a2a] border border-white/5 rounded-2xl font-bold outline-none focus:border-white/10 text-white"
                    value={formData.price || 0}
                    onChange={(e) =>
                      setFormData({ ...formData, price: parseFloat(e.target.value) })
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1 ml-1">
                    Este será o menor preço do produto
                  </p>
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-gray-400 uppercase ml-1">Categoria</span>
                  <select
                    className="mt-1 w-full p-4 bg-[#2a2a2a] border border-white/5 rounded-2xl font-bold outline-none focus:border-white/10 text-white appearance-none"
                    value={formData.category_id || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, category_id: e.target.value })
                    }
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center space-x-6 p-2">
                <label className="flex items-center cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={formData.is_available}
                      onChange={(e) =>
                        setFormData({ ...formData, is_available: e.target.checked })
                      }
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors ${formData.is_available ? 'bg-orange-500' : 'bg-gray-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.is_available ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <span className="ml-3 text-xs font-bold text-gray-400 uppercase group-hover:text-white transition-colors">Disponível</span>
                </label>

                <label className="flex items-center cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={formData.is_promotion}
                      onChange={(e) =>
                        setFormData({ ...formData, is_promotion: e.target.checked })
                      }
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors ${formData.is_promotion ? 'bg-orange-500' : 'bg-gray-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.is_promotion ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <span className="ml-3 text-xs font-bold text-gray-400 uppercase group-hover:text-white transition-colors">Promoção</span>
                </label>
              </div>

              {/* Variações (Templates) */}
              <div className="bg-white/5 border border-white/10 p-5 rounded-2xl mt-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Variações (Templates)</h3>
                
                {availableTemplates.length === 0 ? (
                  <p className="text-gray-500 text-xs">
                    Nenhum template criado. Vá em "Variações" no menu lateral para criar.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {availableTemplates.map(template => (
                      <label 
                        key={template.id}
                        className="flex items-center gap-3 p-3 bg-black/30 rounded-xl border border-white/10 hover:border-white/20 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTemplates.includes(template.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTemplates([...selectedTemplates, template.id]);
                            } else {
                              setSelectedTemplates(selectedTemplates.filter(id => id !== template.id));
                            }
                          }}
                          className="w-5 h-5 rounded border-gray-700 text-orange-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-semibold text-white">{template.name}</span>
                          <span className="text-[10px] text-gray-500 ml-2 uppercase">
                            ({(template as any).variation_option_templates?.length || 0} opções)
                          </span>
                        </div>
                        {template.is_required && (
                          <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold uppercase">
                            Obrigatório
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-[#2a2a2a] border-t border-white/10 flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setFormData({});
                  setSelectedTemplates([]);
                }}
                className="flex-1 py-4 rounded-2xl font-bold text-gray-400 hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg"
              >
                {formData.id ? 'Salvar Alterações' : 'Criar Produto'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE ADICIONAIS */}
      {selectedProductForExtras && (
        <ExtrasManager
          product={selectedProductForExtras}
          onClose={() => setSelectedProductForExtras(null)}
        />
      )}

      {/* NOVO: MODAL DE VARIAÇÕES */}
      {selectedProductForVariations && (
        <VariationsManager
          product={selectedProductForVariations}
          onClose={() => setSelectedProductForVariations(null)}
        />
      )}
    </div>
  );
};

export default ProductManager;
