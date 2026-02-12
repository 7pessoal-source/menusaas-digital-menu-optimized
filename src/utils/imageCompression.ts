import imageCompression from 'browser-image-compression';

interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
}

/**
 * Comprime uma imagem mantendo qualidade visual
 * @param file - Arquivo de imagem original
 * @param options - Opções de compressão
 * @returns Arquivo comprimido
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxSizeMB = 0.5,           // Máximo 500KB
    maxWidthOrHeight = 800,     // Máximo 800px de largura/altura
    quality = 0.85,             // 85% de qualidade
    format = 'webp'             // Formato WebP (mais eficiente)
  } = options;

  const compressionOptions = {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker: true,         // Usa Web Worker para não bloquear a UI
    fileType: `image/${format}`,
    initialQuality: quality,
  };

  try {
    console.log(`📦 Comprimindo: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    
    const compressedFile = await imageCompression(file, compressionOptions);
    
    const reduction = ((1 - compressedFile.size / file.size) * 100).toFixed(1);
    console.log(
      `✅ Comprimido: ${compressedFile.name} (${(compressedFile.size / 1024 / 1024).toFixed(2)} MB) - Redução de ${reduction}%`
    );
    
    return compressedFile;
  } catch (error) {
    console.error('❌ Erro na compressão:', error);
    throw new Error('Falha ao comprimir imagem');
  }
}

/**
 * Converte imagem para WebP (formato mais eficiente)
 */
export async function convertToWebP(file: File): Promise<File> {
  return compressImage(file, {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 800,
    format: 'webp'
  });
}

/**
 * Cria versões otimizadas em múltiplos tamanhos (thumbnail, medium, large)
 */
export async function createResponsiveVersions(file: File): Promise<{
  thumbnail: File;
  medium: File;
  large: File;
}> {
  const [thumbnail, medium, large] = await Promise.all([
    compressImage(file, { maxWidthOrHeight: 200, maxSizeMB: 0.1 }),  // Thumbnail: 200px
    compressImage(file, { maxWidthOrHeight: 600, maxSizeMB: 0.3 }),  // Medium: 600px
    compressImage(file, { maxWidthOrHeight: 1200, maxSizeMB: 0.8 }), // Large: 1200px
  ]);

  return { thumbnail, medium, large };
}

/**
 * Valida se o arquivo é uma imagem válida
 */
export function validateImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!validTypes.includes(file.type)) {
    throw new Error('Formato de imagem inválido. Use JPG, PNG, WebP ou GIF.');
  }

  if (file.size > maxSize) {
    throw new Error('Imagem muito grande. Máximo 10MB.');
  }

  return true;
}

/**
 * Cria preview da imagem antes do upload
 */
export async function createImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    
    reader.onerror = () => {
      reject(new Error('Erro ao criar preview da imagem'));
    };
    
    reader.readAsDataURL(file);
  });
}
