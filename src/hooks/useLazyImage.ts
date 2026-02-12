import { useEffect, useRef, useState, useCallback } from 'react';

interface UseLazyImageOptions {
  /**
   * Margem antes de começar a carregar (px)
   * @default "200px"
   */
  rootMargin?: string;
  
  /**
   * Threshold de visibilidade (0-1)
   * @default 0.01
   */
  threshold?: number;
  
  /**
   * URL placeholder enquanto carrega
   */
  placeholder?: string;
  
  /**
   * Callback quando a imagem carregar
   */
  onLoad?: () => void;
  
  /**
   * Callback quando houver erro
   */
  onError?: (error: Event) => void;
}

interface UseLazyImageReturn {
  /**
   * Ref para anexar ao elemento <img>
   */
  imgRef: React.RefObject<HTMLImageElement>;
  
  /**
   * URL da imagem a ser usada no src
   */
  imageSrc: string | null;
  
  /**
   * Estado de carregamento
   */
  isLoading: boolean;
  
  /**
   * Estado de erro
   */
  hasError: boolean;
  
  /**
   * Força reload da imagem
   */
  retry: () => void;
}

/**
 * Hook para lazy loading de imagens com Intersection Observer
 * Carrega imagens apenas quando estão próximas de aparecer na viewport
 * 
 * @example
 * ```tsx
 * const { imgRef, imageSrc, isLoading, hasError, retry } = useLazyImage(
 *   product.image,
 *   { rootMargin: '200px' }
 * );
 * 
 * return (
 *   <div>
 *     {isLoading && <div className="skeleton" />}
 *     <img ref={imgRef} src={imageSrc || ''} alt="Product" />
 *     {hasError && <button onClick={retry}>Tentar novamente</button>}
 *   </div>
 * );
 * ```
 */
export function useLazyImage(
  src: string,
  options: UseLazyImageOptions = {}
): UseLazyImageReturn {
  const {
    rootMargin = '200px',
    threshold = 0.01,
    placeholder,
    onLoad,
    onError,
  } = options;

  const imgRef = useRef<HTMLImageElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(placeholder || null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Função para tentar carregar novamente
  const retry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    setImageSrc(null);
  }, []);

  useEffect(() => {
    const imgElement = imgRef.current;
    if (!imgElement || !src) return;

    // Se já carregou a imagem, não faz nada
    if (imageSrc === src) return;

    // Cleanup do observer anterior
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Cria novo Intersection Observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Quando a imagem entra na viewport (ou está próxima)
          if (entry.isIntersecting && !imageSrc) {
            setImageSrc(src);
            
            // Desconecta o observer após iniciar o carregamento
            if (observerRef.current) {
              observerRef.current.disconnect();
            }
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    // Inicia observação
    observerRef.current.observe(imgElement);

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [src, imageSrc, rootMargin, threshold]);

  // Listeners de eventos da imagem
  useEffect(() => {
    const imgElement = imgRef.current;
    if (!imgElement) return;

    const handleLoad = () => {
      setIsLoading(false);
      setHasError(false);
      onLoad?.();
    };

    const handleError = (event: Event) => {
      setIsLoading(false);
      setHasError(true);
      onError?.(event);
      console.error('Erro ao carregar imagem:', src);
    };

    imgElement.addEventListener('load', handleLoad);
    imgElement.addEventListener('error', handleError);

    return () => {
      imgElement.removeEventListener('load', handleLoad);
      imgElement.removeEventListener('error', handleError);
    };
  }, [src, onLoad, onError]);

  return {
    imgRef,
    imageSrc,
    isLoading,
    hasError,
    retry,
  };
}

/**
 * Hook simplificado para imagens com preload
 * Útil para imagens críticas (logo, hero image)
 */
export function usePreloadImage(src: string): boolean {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    
    img.onload = () => {
      setIsLoaded(true);
    };
    
    img.onerror = () => {
      console.error('Erro ao preload da imagem:', src);
      setIsLoaded(true); // Marca como "carregado" mesmo com erro
    };
    
    img.src = src;
  }, [src]);

  return isLoaded;
}

/**
 * Hook para batch loading de múltiplas imagens
 * Útil para carrossel ou galeria
 */
export function useBatchImageLoader(
  urls: string[],
  batchSize: number = 3
): {
  loadedImages: Set<string>;
  isLoading: boolean;
  loadMore: () => void;
} {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [currentBatch, setCurrentBatch] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const startIndex = currentBatch * batchSize;
    const endIndex = startIndex + batchSize;
    const batch = urls.slice(startIndex, endIndex);

    if (batch.length === 0) return;

    setIsLoading(true);

    const loadPromises = batch.map((url) => {
      return new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = () => reject(url);
        img.src = url;
      });
    });

    Promise.allSettled(loadPromises).then((results) => {
      const loaded = results
        .filter((r) => r.status === 'fulfilled')
        .map((r) => (r as PromiseFulfilledResult<string>).value);

      setLoadedImages((prev) => new Set([...prev, ...loaded]));
      setIsLoading(false);
    });
  }, [currentBatch, batchSize, urls]);

  const loadMore = useCallback(() => {
    setCurrentBatch((prev) => prev + 1);
  }, []);

  return { loadedImages, isLoading, loadMore };
}
