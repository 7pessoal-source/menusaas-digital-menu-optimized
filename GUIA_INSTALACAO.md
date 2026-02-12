# 🚀 Guia de Instalação Rápida - Otimização de Imagens

## ⚡ Setup Rápido (10 minutos)

### 1️⃣ Instalar Dependências

```bash
npm install browser-image-compression
```

### 2️⃣ Adicionar os Arquivos ao Projeto

Copie os arquivos para as pastas corretas:

```
src/
├── utils/
│   ├── imageCompression.ts       ← Funções de compressão
│   └── imageOptimization.ts      ← Otimização de URLs
├── hooks/
│   └── useLazyImage.ts           ← Hook de lazy loading
└── components/
    └── features/
        └── ProductCard.tsx       ← Card otimizado
```

### 3️⃣ Substituir o Grid de Produtos

No arquivo `src/components/features/PublicMenu.tsx`, substitua:

**ANTES:**
```tsx
<div className="grid grid-cols-2 gap-4">
  {filteredProducts.map((product, index) => (
    <div key={product.id} className="..." onClick={() => handleProductClick(product)}>
      {/* ... código do card ... */}
    </div>
  ))}
</div>
```

**DEPOIS:**
```tsx
import ProductCard from './ProductCard';

// ... dentro do return
<div className="grid grid-cols-2 gap-4">
  {filteredProducts.map((product, index) => (
    <ProductCard
      key={product.id}
      product={product}
      index={index}
      onClick={handleProductClick}
    />
  ))}
</div>
```

### 4️⃣ Adicionar Compressão no Upload

No arquivo onde você faz upload de imagens (ex: `ProductManager.tsx`):

```tsx
import { compressImage } from '../../utils/imageCompression';

const handleImageUpload = async (file: File) => {
  try {
    // 1. Comprimir antes de fazer upload
    const compressedFile = await compressImage(file);
    
    // 2. Upload para Supabase
    const filePath = `${restaurantId}/${Date.now()}.webp`;
    const { data, error } = await supabase.storage
      .from('products')
      .upload(filePath, compressedFile, {
        cacheControl: '31536000' // Cache de 1 ano
      });
    
    if (error) throw error;
    
    // 3. Obter URL pública
    const { data: publicUrl } = supabase.storage
      .from('products')
      .getPublicUrl(filePath);
    
    // 4. Salvar no banco de dados
    await saveProductImage(publicUrl.publicUrl);
  } catch (error) {
    console.error('Erro no upload:', error);
  }
};
```

### 5️⃣ (OPCIONAL) Comprimir Imagens Existentes

Se você já tem imagens no sistema, rode o script de compressão:

```bash
# 1. Criar arquivo .env com credenciais
echo "VITE_SUPABASE_URL=sua_url_aqui" >> .env
echo "VITE_SUPABASE_ANON_KEY=sua_key_aqui" >> .env

# 2. Executar script (pode demorar vários minutos)
node compress-existing-images.js
```

---

## ✅ Checklist de Verificação

Após a instalação, verifique:

- [ ] `npm install` rodou sem erros
- [ ] Arquivos copiados para as pastas corretas
- [ ] ProductCard importado no PublicMenu
- [ ] Compressão adicionada no upload
- [ ] Imagens carregam com lazy loading
- [ ] Skeleton loader aparece enquanto carrega

---

## 📊 Como Testar a Performance

### Teste 1: Chrome DevTools

```bash
1. Abra Chrome DevTools (F12)
2. Vá para a aba "Network"
3. Filtro: "Img"
4. Recarregue a página
5. Verifique:
   - Tamanho dos arquivos (deve ser <300KB)
   - Tempo de carregamento
   - Número de requisições simultâneas (deve ser ~3-5, não 20+)
```

### Teste 2: Lighthouse

```bash
# No Chrome DevTools
1. Aba "Lighthouse"
2. Selecione "Performance" + "Mobile"
3. Clique "Generate report"
4. Meta: Score > 70
```

### Teste 3: Slow 3G

```bash
1. DevTools > Network
2. Throttling: "Slow 3G"
3. Recarregue a página
4. Observe:
   - Imagens carregam progressivamente
   - Skeleton loader aparece
   - Não trava o navegador
```

---

## 🎯 Resultados Esperados

### Performance

| Métrica | Antes | Depois |
|---------|-------|--------|
| Tamanho da imagem | 2-5 MB | 100-300 KB |
| Tempo de load (cada imagem) | 3-8s | 0.3-1s |
| Lighthouse Score | 30-40 | 70-85+ |
| LCP (Largest Contentful Paint) | 6s | <2s |

### Experiência do Usuário

- ✅ Página carrega 5-10x mais rápido
- ✅ Scroll suave sem travamentos
- ✅ Feedback visual (skeleton loader)
- ✅ Funciona bem em conexões lentas
- ✅ Economiza dados móveis

---

## ⚙️ Configurações Avançadas (Opcional)

### Ajustar Qualidade de Compressão

Em `imageCompression.ts`, linha 20:

```typescript
const {
  maxSizeMB = 0.5,      // Menor = mais compressão (0.3 a 1.0)
  maxWidthOrHeight = 800, // Menor = mais compressão (600 a 1200)
  quality = 0.85,       // Menor = mais compressão (0.7 a 0.95)
  format = 'webp'       // webp = melhor compressão
} = options;
```

### Ajustar Lazy Loading

Em `useLazyImage.ts`, linha 62:

```typescript
rootMargin: '200px',  // Maior = carrega antes (100px a 500px)
threshold: 0.01,      // Menor = carrega mais cedo (0.01 a 0.5)
```

### Configurar CDN do Supabase

No dashboard do Supabase:

1. Storage > seu_bucket > Settings
2. Ative "Image Transformations"
3. Configure cache headers:

```sql
UPDATE storage.buckets
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png']
WHERE name = 'products';
```

---

## 🐛 Troubleshooting

### Problema: Imagens não aparecem

**Solução:**
```tsx
// Verifique se o hook está retornando imageSrc
console.log('imageSrc:', imageSrc);

// Verifique se a URL está correta
console.log('product.image:', product.image);
```

### Problema: Compressão muito agressiva

**Solução:**
```typescript
// Aumente a qualidade em imageCompression.ts
quality = 0.90,  // Era 0.85
maxSizeMB = 0.8,   // Era 0.5
```

### Problema: Skeleton loader não aparece

**Solução:**
```tsx
// Verifique se isLoading está sendo setado
console.log('isLoading:', isLoading);

// Certifique-se que o CSS de shimmer foi injetado
```

### Problema: Script de compressão falha

**Solução:**
```bash
# Verifique variáveis de ambiente
cat .env

# Execute com logs
node compress-existing-images.js 2>&1 | tee compression.log
```

---

## 📞 Suporte

Se tiver problemas:

1. Verifique o console do navegador (F12)
2. Verifique os logs do terminal
3. Confirme que as URLs das imagens são válidas
4. Teste com uma imagem de exemplo primeiro

---

## 🎓 Próximos Passos

Depois que tudo estiver funcionando:

1. **Monitoramento**: Configure Google Analytics ou Sentry
2. **PWA**: Adicione Service Worker para cache offline
3. **CDN Premium**: Migre para Cloudflare Images (melhor performance)
4. **Virtualização**: Para >100 produtos, use react-window

---

## ✨ Dicas Finais

- Sempre teste em ambiente de desenvolvimento primeiro
- Faça backup do banco antes de rodar scripts
- Monitore o uso de storage do Supabase
- Considere deletar imagens antigas após compressão
- Configure alertas para imagens muito grandes (>1MB)
