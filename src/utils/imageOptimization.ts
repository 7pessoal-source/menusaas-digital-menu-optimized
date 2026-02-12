/**
 * Utilitário para otimização de URLs de imagens
 * Suporta Supabase Storage e Cloudflare Images
 */

interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'auto';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  blur?: number;
}

/**
 * Gera URL otimizada para imagem do Supabase Storage
 */
export function getSupabaseImageUrl(
  url: string,
  options: ImageTransformOptions = {}
): string {
  if (!url || !url.includes('supabase')) {
    return url;
  }

  const {
    width = 800,
    height = 800,
    quality = 85,
    format = 'webp',
    fit = 'cover',
  } = options;

  // Remove parâmetros existentes
  const baseUrl = url.split('?')[0];

  // Adiciona transformações do Supabase
  const params = new URLSearchParams({
    width: width.toString(),
    height: height.toString(),
    quality: quality.toString(),
    format: format === 'auto' ? 'webp' : format,
    resize: fit,
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Gera URL otimizada para Cloudflare Images
 * Requer: Account ID e Image ID
 */
export function getCloudflareImageUrl(
  imageId: string,
  options: ImageTransformOptions = {}
): string {
  const accountHash = process.env.VITE_CLOUDFLARE_ACCOUNT_HASH;
  
  if (!accountHash) {
    console.warn('VITE_CLOUDFLARE_ACCOUNT_HASH não configurado');
    return imageId;
  }

  const {
    width = 800,
    height = 800,
    quality = 85,
    format = 'auto',
    fit = 'cover',
    blur,
  } = options;

  // Constrói variante personalizada
  let variant = `w=${width},h=${height},q=${quality},fit=${fit},format=${format}`;
  
  if (blur) {
    variant += `,blur=${blur}`;
  }

  return `https://imagedelivery.net/${accountHash}/${imageId}/${variant}`;
}

/**
 * Gera srcset responsivo para diferentes tamanhos de tela
 */
export function getResponsiveSrcSet(
  url: string,
  sizes: number[] = [400, 800, 1200]
): string {
  return sizes
    .map((size) => {
      const optimizedUrl = getSupabaseImageUrl(url, { 
        width: size, 
        height: size,
        quality: 85 
      });
      return `${optimizedUrl} ${size}w`;
    })
    .join(', ');
}

/**
 * Determina o tamanho ideal da imagem baseado no viewport
 */
export function getOptimalImageSize(): number {
  if (typeof window === 'undefined') return 800;

  const width = window.innerWidth;
  const dpr = window.devicePixelRatio || 1;

  // Mobile
  if (width < 640) return Math.ceil(400 * dpr);
  // Tablet
  if (width < 1024) return Math.ceil(600 * dpr);
  // Desktop
  return Math.ceil(800 * dpr);
}

/**
 * Gera URL otimizada automaticamente baseada no contexto
 */
export function getOptimizedImageUrl(
  url: string,
  context: 'thumbnail' | 'card' | 'detail' | 'hero' = 'card'
): string {
  if (!url) return '';

  // Configurações por contexto
  const configs = {
    thumbnail: { width: 200, height: 200, quality: 80 },
    card: { width: 400, height: 400, quality: 85 },
    detail: { width: 800, height: 800, quality: 90 },
    hero: { width: 1200, height: 800, quality: 90 },
  };

  const config = configs[context];

  // Se for Supabase
  if (url.includes('supabase')) {
    return getSupabaseImageUrl(url, config);
  }

  // Se for Cloudflare (contém imagedelivery.net)
  if (url.includes('imagedelivery.net')) {
    const imageId = url.split('/').pop() || '';
    return getCloudflareImageUrl(imageId, config);
  }

  // URL externa - retorna como está
  return url;
}

/**
 * Gera placeholder blur hash enquanto a imagem carrega
 * Requer biblioteca blurhash
 */
export function getBlurDataURL(width: number = 10, height: number = 10): string {
  // Gera um SVG blur simples como placeholder
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#2a2a2a;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1a1a1a;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#gradient)" />
    </svg>
  `.trim();

  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Converte URL do Supabase Storage para ID do Cloudflare
 * Útil para migração
 */
export async function uploadToCloudflare(
  supabaseUrl: string,
  cloudflareToken: string,
  accountId: string
): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('url', supabaseUrl);

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cloudflareToken}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudflare API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result.id; // Retorna o ID da imagem no Cloudflare
  } catch (error) {
    console.error('Erro ao fazer upload para Cloudflare:', error);
    throw error;
  }
}

/**
 * Batch upload de múltiplas imagens para Cloudflare
 */
export async function batchUploadToCloudflare(
  urls: string[],
  cloudflareToken: string,
  accountId: string,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (let i = 0; i < urls.length; i++) {
    try {
      const cloudflareId = await uploadToCloudflare(urls[i], cloudflareToken, accountId);
      results.set(urls[i], cloudflareId);
      onProgress?.(i + 1, urls.length);
    } catch (error) {
      console.error(`Erro no upload de ${urls[i]}:`, error);
    }
  }

  return results;
}

/**
 * Preload de imagem crítica
 */
export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Batch preload de múltiplas imagens
 */
export async function preloadImages(urls: string[]): Promise<void> {
  await Promise.all(urls.map(preloadImage));
}

/**
 * Detecta suporte a WebP no navegador
 */
export function supportsWebP(): Promise<boolean> {
  return new Promise((resolve) => {
    const webpData = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
    const img = new Image();
    
    img.onload = () => resolve(img.width === 1);
    img.onerror = () => resolve(false);
    img.src = webpData;
  });
}

/**
 * Determina melhor formato de imagem baseado no suporte do navegador
 */
export async function getBestImageFormat(): Promise<'webp' | 'jpeg'> {
  const hasWebP = await supportsWebP();
  return hasWebP ? 'webp' : 'jpeg';
}
