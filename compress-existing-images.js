/**
 * Script para comprimir todas as imagens existentes no Supabase Storage
 * 
 * USO:
 * 1. npm install browser-image-compression
 * 2. Configure as variáveis SUPABASE_URL e SUPABASE_KEY
 * 3. node scripts/compress-existing-images.js
 */

import { createClient } from '@supabase/supabase-js';
import imageCompression from 'browser-image-compression';

// ⚠️ CONFIGURE ESTAS VARIÁVEIS
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_KEY';
const STORAGE_BUCKET = 'products'; // Nome do bucket onde as imagens estão

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Baixa imagem de uma URL
 */
async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  
  const blob = await response.blob();
  const fileName = url.split('/').pop() || 'image.jpg';
  return new File([blob], fileName, { type: blob.type });
}

/**
 * Comprime uma imagem
 */
async function compressImage(file) {
  const options = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 800,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.85,
  };

  return await imageCompression(file, options);
}

/**
 * Faz upload da imagem comprimida
 */
async function uploadCompressed(file, path) {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      cacheControl: '31536000', // 1 ano de cache
      upsert: true, // Sobrescreve se já existe
    });

  if (error) throw error;
  return data;
}

/**
 * Processa uma imagem: baixa, comprime e faz re-upload
 */
async function processImage(imageUrl, productId) {
  try {
    console.log(`\n📥 Baixando imagem do produto ${productId}...`);
    const originalFile = await downloadImage(imageUrl);
    const originalSizeMB = (originalFile.size / 1024 / 1024).toFixed(2);
    console.log(`   Tamanho original: ${originalSizeMB} MB`);

    console.log(`📦 Comprimindo...`);
    const compressedFile = await compressImage(originalFile);
    const compressedSizeMB = (compressedFile.size / 1024 / 1024).toFixed(2);
    const reduction = ((1 - compressedFile.size / originalFile.size) * 100).toFixed(1);
    console.log(`   Tamanho comprimido: ${compressedSizeMB} MB (${reduction}% de redução)`);

    // Gera novo nome de arquivo
    const timestamp = Date.now();
    const newFileName = `${productId}/${timestamp}.webp`;

    console.log(`📤 Fazendo upload...`);
    const uploadData = await uploadCompressed(compressedFile, newFileName);

    // Gera URL pública
    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(newFileName);

    const newUrl = publicUrlData.publicUrl;

    // Atualiza registro no banco
    console.log(`💾 Atualizando banco de dados...`);
    const { error: updateError } = await supabase
      .from('products')
      .update({ image: newUrl })
      .eq('id', productId);

    if (updateError) throw updateError;

    console.log(`✅ Sucesso! Nova URL: ${newUrl}`);
    return {
      success: true,
      productId,
      originalSize: originalFile.size,
      compressedSize: compressedFile.size,
      reduction,
      newUrl,
    };
  } catch (error) {
    console.error(`❌ Erro ao processar produto ${productId}:`, error.message);
    return {
      success: false,
      productId,
      error: error.message,
    };
  }
}

/**
 * Busca todos os produtos com imagens
 */
async function getAllProductsWithImages() {
  const { data, error } = await supabase
    .from('products')
    .select('id, image, name')
    .not('image', 'is', null);

  if (error) throw error;
  return data;
}

/**
 * Execução principal
 */
async function main() {
  console.log('🚀 Iniciando compressão de imagens...\n');
  console.log(`📍 Supabase URL: ${SUPABASE_URL}`);
  console.log(`📦 Bucket: ${STORAGE_BUCKET}\n`);

  try {
    // 1. Busca produtos
    console.log('🔍 Buscando produtos com imagens...');
    const products = await getAllProductsWithImages();
    console.log(`   Encontrados: ${products.length} produtos\n`);

    if (products.length === 0) {
      console.log('⚠️  Nenhum produto com imagem encontrado.');
      return;
    }

    // 2. Processa cada imagem
    const results = [];
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`\n[${i + 1}/${products.length}] Processando: ${product.name}`);
      
      const result = await processImage(product.image, product.id);
      results.push(result);

      // Pausa para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 3. Relatório final
    console.log('\n\n========================================');
    console.log('📊 RELATÓRIO FINAL');
    console.log('========================================\n');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ Sucesso: ${successful.length}`);
    console.log(`❌ Falhas: ${failed.length}`);

    if (successful.length > 0) {
      const totalOriginal = successful.reduce((sum, r) => sum + r.originalSize, 0);
      const totalCompressed = successful.reduce((sum, r) => sum + r.compressedSize, 0);
      const totalReduction = ((1 - totalCompressed / totalOriginal) * 100).toFixed(1);

      console.log(`\n💾 Tamanho total original: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
      console.log(`💾 Tamanho total comprimido: ${(totalCompressed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`📉 Redução total: ${totalReduction}%`);
    }

    if (failed.length > 0) {
      console.log('\n⚠️  Produtos com falha:');
      failed.forEach(r => {
        console.log(`   - ${r.productId}: ${r.error}`);
      });
    }

    console.log('\n✅ Processo concluído!\n');
  } catch (error) {
    console.error('\n❌ Erro fatal:', error.message);
    process.exit(1);
  }
}

// Executa
main().catch(console.error);
