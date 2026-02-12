import React from 'react';
import { Flame, Store as StoreIcon } from 'lucide-react';
import { Product } from '../../types';
import { useLazyImage } from '../../hooks/useLazyImage';
import { formatProductPrice } from '../../utils/priceRange';

interface ProductCardProps {
  product: Product;
  index: number;
  onClick: (product: Product) => void;
}

/**
 * Card de produto otimizado com:
 * - Lazy loading inteligente
 * - Skeleton loader
 * - Fallback para erro
 * - Animação de entrada
 */
const ProductCard: React.FC<ProductCardProps> = ({ product, index, onClick }) => {
  const { imgRef, imageSrc, isLoading, hasError, retry } = useLazyImage(
    product.image || '',
    {
      rootMargin: '200px', // Começa a carregar 200px antes de aparecer
      threshold: 0.01,
      onError: (error) => {
        console.error(`Erro ao carregar imagem do produto ${product.name}:`, error);
      }
    }
  );

  return (
    <div
      className="group bg-[#2a2a2a]/50 backdrop-blur-sm rounded-3xl p-4 border border-white/5 hover:border-white/10 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden cursor-pointer"
      onClick={() => onClick(product)}
      style={{
        animation: `fadeInUp 0.4s ease-out ${index * 0.05}s both`
      }}
    >
      {/* Badge de promoção */}
      {product.is_promotion && (
        <div className="absolute top-3 right-3 z-10">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-2 rounded-full shadow-lg animate-pulse">
            <Flame size={14} className="text-white" />
          </div>
        </div>
      )}

      {/* Container da Imagem */}
      <div className="w-full aspect-square rounded-2xl overflow-hidden bg-[#1a1a1a] mb-3 flex items-center justify-center relative">
        {/* Skeleton Loader - exibe enquanto carrega */}
        {isLoading && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-[#1a1a1a] via-[#2a2a2a] to-[#1a1a1a] bg-[length:200%_100%]" 
               style={{ animation: 'shimmer 1.5s infinite' }} />
        )}

        {/* Imagem */}
        {product.image ? (
          <>
            <img
              ref={imgRef}
              src={imageSrc || ''}
              alt={product.name}
              className={`w-full h-full object-cover group-hover:scale-110 transition-all duration-500 ${
                isLoading ? 'opacity-0' : 'opacity-100'
              }`}
              loading="lazy"
              decoding="async"
            />

            {/* Overlay de erro com botão de retry */}
            {hasError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a1a]/90">
                <StoreIcon size={32} className="text-gray-600 mb-2" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    retry();
                  }}
                  className="text-xs text-orange-500 hover:text-orange-400 underline"
                >
                  Tentar novamente
                </button>
              </div>
            )}
          </>
        ) : (
          // Placeholder quando não há imagem
          <StoreIcon size={40} className="text-gray-700" />
        )}
      </div>

      {/* Informações do Produto */}
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-white line-clamp-2 leading-tight min-h-[2.5rem]">
          {product.name}
        </h3>

        {product.description && (
          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        )}

        {/* Preço */}
        <div className="flex items-baseline justify-between pt-2">
          <div className="flex flex-col">
            <span className="text-lg font-black text-orange-500">
              {formatProductPrice(product)}
            </span>
            {product.is_promotion && product.original_price && (
              <span className="text-xs text-gray-500 line-through">
                R$ {product.original_price.toFixed(2)}
              </span>
            )}
          </div>

          {/* Badge de disponibilidade */}
          {!product.is_available && (
            <span className="text-[10px] px-2 py-1 bg-red-500/20 text-red-500 rounded-full font-bold">
              Indisponível
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// CSS personalizado para animação shimmer
const styles = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
`;

// Injeta estilos no documento
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default ProductCard;
