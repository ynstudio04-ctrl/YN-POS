
import type { Product, Sale, Settings } from '../types';
import {
  loadProducts,
  saveProducts,
  loadSales,
  saveSales,
  loadSettings,
  saveSettings,
} from '../data/demo';
import { supabase, supabaseConfigured } from './supabase';

export interface Repository {
  getProducts(): Promise<Product[]>;
  getProductByBarcode(b: string): Promise<Product | null>;
  searchProducts(q: string): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  createProduct(p: Product): Promise<Product>;
  updateProduct(p: Product): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  getCategories(): Promise<string[]>;
  createCategory(name: string): Promise<string>;
  deleteCategory(name: string): Promise<void>;
  getSales(): Promise<Sale[]>;
  getSale(id: string): Promise<Sale | null>;
  createSale(s: Sale): Promise<Sale>;
  getSettings(): Promise<Settings>;
  updateSettings(s: Settings): Promise<Settings>;
  uploadProductImage(productId: string, file: Blob): Promise<string>;
  uploadQrCode(file: Blob): Promise<string>;
}

const makeId = () => crypto.randomUUID();

/* =========================
   HELPERS
========================= */

function mapProduct(x: any): Product {
  return {
    id: x.id,
    name: x.name,
    barcode: x.barcode || undefined,
    category:
      x.category_name ??
      x.category ??
      x.categories?.name ??
      undefined,
    price: Number(x.price),
    stock: Number(x.stock_quantity),
    imageUrl: x.image_url || undefined,
    isActive: x.is_active,
    priceOptions: Array.isArray(x.price_options) ? x.price_options : undefined,
  };
}

function toProductRow(p: Product) {
  return {
    id: p.id,
    name: p.name.trim(),
    barcode: p.barcode?.trim() || null,
    price: Number(p.price) || 0,
    stock_quantity: Number(p.stock) || 0,
    image_url: p.imageUrl || null,
    is_active: p.isActive !== false,
    price_options: p.priceOptions || [],
  };
}

function mapSale(x: any): Sale {
  return {
    id: x.id,
    receiptNumber: x.receipt_number,
    subtotal: Number(x.subtotal),
    discount: Number(x.discount),
    tax: Number(x.tax),
    total: Number(x.total),
    paymentMethod: x.payment_method,
    cashReceived:
      x.cash_received == null
        ? undefined
        : Number(x.cash_received),
    change:
      x.change_amount == null
        ? undefined
        : Number(x.change_amount),
    createdAt: x.created_at,
    items: (x.sale_items || []).map((i: any) => ({
      id: i.product_id,
      name: i.product_name,
      price: Number(i.unit_price),
      quantity: Number(i.quantity),
      stock: 0,
      barcode: undefined,
      category: undefined,
    })),
  };
}

function escapeIlike(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/,/g, '');
}

/* =========================
   DEMO REPOSITORY
========================= */

export class DemoRepository implements Repository {
  async getProducts(): Promise<Product[]> {
    return loadProducts().filter(
      (p: Product) => p.isActive !== false
    );
  }

  async getProductByBarcode(
    barcode: string
  ): Promise<Product | null> {
    return (
      loadProducts().find(
        (p: Product) => p.barcode === barcode
      ) || null
    );
  }

  async searchProducts(q: string): Promise<Product[]> {
    const search = q.trim().toLowerCase();

    return loadProducts().filter((p: Product) =>
      [
        p.name,
        p.barcode,
        p.category,
      ].some(
        value =>
          value?.toLowerCase().includes(search)
      )
    );
  }

  async getProduct(
    productId: string
  ): Promise<Product | null> {
    return (
      loadProducts().find(
        (p: Product) => p.id === productId
      ) || null
    );
  }

  async createProduct(
    p: Product
  ): Promise<Product> {
    const product: Product = {
      ...p,
      id: p.id || makeId(),
      isActive: true,
    };

    const products = loadProducts();
    products.push(product);
    saveProducts(products);

    return product;
  }

  async updateProduct(
    p: Product
  ): Promise<Product> {
    const products = loadProducts().map(
      (product: Product) =>
        product.id === p.id
          ? p
          : product
    );

    saveProducts(products);

    return p;
  }

  async deleteProduct(
    productId: string
  ): Promise<void> {
    const products = loadProducts().map(
      (product: Product) =>
        product.id === productId
          ? {
              ...product,
              isActive: false,
            }
          : product
    );

    saveProducts(products);
  }

  async getCategories(): Promise<string[]> { return JSON.parse(localStorage.getItem('yn-categories') || '[]'); }
  async createCategory(name: string): Promise<string> { const n=name.trim(); if(!n) throw new Error('Category name is required'); const all=await this.getCategories(); if(!all.includes(n)){all.push(n); localStorage.setItem('yn-categories',JSON.stringify(all));} return n; }
  async deleteCategory(name: string): Promise<void> { const n=name.trim(); const all=await this.getCategories(); localStorage.setItem('yn-categories', JSON.stringify(all.filter(c => c !== n))); }

  async getSales(): Promise<Sale[]> {
    return loadSales();
  }

  async getSale(
    saleId: string
  ): Promise<Sale | null> {
    return (
      loadSales().find(
        sale => sale.id === saleId
      ) || null
    );
  }

  async createSale(
    sale: Sale
  ): Promise<Sale> {
    const sales = loadSales();

    sales.unshift(sale);
    saveSales(sales);

    const products = loadProducts();

    for (const item of sale.items) {
      const product = products.find(
        (p: Product) =>
          p.id === item.id
      );

      if (product) {
        product.stock -= item.quantity;
      }
    }

    saveProducts(products);

    return sale;
  }

  async uploadQrCode(file: Blob): Promise<string> {
    const reader = new FileReader();
    return await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read QR image.'));
      reader.readAsDataURL(file);
    });
  }

  async getSettings(): Promise<Settings> {
    return loadSettings();
  }

  async updateSettings(
    settings: Settings
  ): Promise<Settings> {
    saveSettings(settings);
    return settings;
  }

  async uploadProductImage(
    productId: string,
    file: Blob
  ): Promise<string> {
    return URL.createObjectURL(file);
  }
}

/* =========================
   SUPABASE REPOSITORY
========================= */

export class SupabaseRepository
  implements Repository
{
  constructor(
    private db: NonNullable<typeof supabase>
  ) {}

  async getProducts(): Promise<Product[]> {
    const { data, error } =
      await this.db
        .from('products')
        .select('*,categories(name)')
        .eq('is_active', true)
        .order('name');

    if (error) throw error;

    return (data || []).map(mapProduct);
  }

  async getProductByBarcode(
    barcode: string
  ): Promise<Product | null> {
    const { data, error } =
      await this.db
        .from('products')
        .select('*,categories(name)')
        .eq('barcode', barcode)
        .eq('is_active', true)
        .maybeSingle();

    if (error) throw error;

    return data ? mapProduct(data) : null;
  }

  async searchProducts(
    q: string
  ): Promise<Product[]> {
    const value = q.trim();

    if (!value) {
      return this.getProducts();
    }

    const safe = escapeIlike(value);

    const { data, error } =
      await this.db
        .from('products')
        .select('*,categories(name)')
        .or(
          `name.ilike.%${safe}%,barcode.ilike.%${safe}%,sku.ilike.%${safe}%`
        )
        .eq('is_active', true)
        .order('name')
        .limit(50);

    if (error) throw error;

    return (data || []).map(mapProduct);
  }

  async getProduct(
    productId: string
  ): Promise<Product | null> {
    const { data, error } =
      await this.db
        .from('products')
        .select('*,categories(name)')
        .eq('id', productId)
        .maybeSingle();

    if (error) throw error;

    return data ? mapProduct(data) : null;
  }

  private async categoryId(
    categoryName?: string
  ) {
    const value = categoryName?.trim();

    if (!value) {
      return null;
    }

    const { data, error } =
      await this.db
        .from('categories')
        .upsert(
          { name: value },
          {
            onConflict: 'name',
          }
        )
        .select('id')
        .single();

    if (error) throw error;

    return data.id;
  }

  async createProduct(
    p: Product
  ): Promise<Product> {
    const categoryId =
      await this.categoryId(
        p.category
      );

    const row = {
      ...toProductRow(p),
      category_id: categoryId,

      // Never save a temporary browser
      // object URL into Supabase.
      image_url: null,
    };

    const { data, error } =
      await this.db
        .from('products')
        .insert(row)
        .select('*,categories(name)')
        .single();

    if (error) throw error;

    return mapProduct(data);
  }

  async updateProduct(
    p: Product
  ): Promise<Product> {
    const categoryId =
      await this.categoryId(
        p.category
      );

    const { data, error } =
      await this.db
        .from('products')
        .update({
          ...toProductRow(p),
          category_id: categoryId,
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', p.id)
        .select('*,categories(name)')
        .single();

    if (error) throw error;

    return mapProduct(data);
  }

  async deleteProduct(
    productId: string
  ): Promise<void> {
    const { error } =
      await this.db
        .from('products')
        .update({
          is_active: false,
        })
        .eq('id', productId);

    if (error) throw error;
  }

  async getCategories(): Promise<string[]> { const {data,error}=await this.db.from('categories').select('name').order('name'); if(error) throw error; return (data||[]).map((x:any)=>x.name); }
  async createCategory(name: string): Promise<string> { const n=name.trim(); if(!n) throw new Error('Category name is required'); const {error}=await this.db.from('categories').upsert({name:n},{onConflict:'name'}); if(error) throw error; return n; }
  async deleteCategory(name: string): Promise<void> { const n=name.trim(); if(!n) throw new Error('Category name is required'); const {error}=await this.db.from('categories').delete().eq('name', n); if(error) throw error; }

  async getSales(): Promise<Sale[]> {
    const { data, error } =
      await this.db
        .from('sales')
        .select('*,sale_items(*)')
        .order('created_at', {
          ascending: false,
        });

    if (error) throw error;

    return (data || []).map(mapSale);
  }

  async getSale(
    saleId: string
  ): Promise<Sale | null> {
    const { data, error } =
      await this.db
        .from('sales')
        .select('*,sale_items(*)')
        .eq('id', saleId)
        .maybeSingle();

    if (error) throw error;

    return data ? mapSale(data) : null;
  }

  async createSale(
    sale: Sale
  ): Promise<Sale> {
    // Prefer the database RPC because it can save the sale and update stock atomically.
    const rpc = await this.db.rpc('create_sale', {
      p_subtotal: sale.subtotal,
      p_discount: sale.discount,
      p_tax: sale.tax,
      p_total: sale.total,
      p_payment_method: sale.paymentMethod,
      p_cash_received: sale.cashReceived ?? null,
      p_change_amount: sale.change ?? null,
      p_items: sale.items.map(item => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        line_total: item.price * item.quantity,
      })),
    });

    if (!rpc.error) {
      const saved = await this.getSale(rpc.data as string);
      if (!saved) throw new Error('The sale was saved, but the receipt could not be loaded.');
      return saved;
    }

    // Some deployments do not have the optional create_sale SQL function. Try the
    // normal tables as a compatibility fallback, but keep the original error visible
    // if the fallback also fails.
    const rpcMessage = rpc.error.message || 'Unknown Supabase RPC error';
    try {
      // Check stock before writing anything so a failed checkout does not create a
      // partially completed sale.
      for (const item of sale.items) {
        const { data: product, error: productError } = await this.db
          .from('products')
          .select('stock_quantity')
          .eq('id', item.id)
          .single();
        if (productError) throw new Error(`Could not check stock for "${item.name}": ${productError.message}`);
        if (Number(product.stock_quantity) < item.quantity) {
          throw new Error(`Not enough stock for "${item.name}". Available: ${Number(product.stock_quantity)}, requested: ${item.quantity}.`);
        }
      }

      const receiptNumber = sale.receiptNumber || '#YN-' + String(Date.now()).slice(-6);
      const { data: inserted, error: saleError } = await this.db
        .from('sales')
        .insert({
          id: sale.id,
          receipt_number: receiptNumber,
          subtotal: sale.subtotal,
          discount: sale.discount,
          tax: sale.tax,
          total: sale.total,
          payment_method: sale.paymentMethod,
          cash_received: sale.cashReceived ?? null,
          change_amount: sale.change ?? null,
        })
        .select('id')
        .single();
      if (saleError) throw new Error(`Could not save the sale: ${saleError.message}`);

      const { error: itemError } = await this.db.from('sale_items').insert(
        sale.items.map(item => ({
          sale_id: inserted.id,
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          line_total: item.price * item.quantity,
        }))
      );
      if (itemError) throw new Error(`The sale was created but the items could not be saved: ${itemError.message}`);

      for (const item of sale.items) {
        const { data: product, error: productError } = await this.db
          .from('products')
          .select('stock_quantity')
          .eq('id', item.id)
          .single();
        if (productError) throw new Error(`Could not update stock for "${item.name}": ${productError.message}`);
        const { error: updateError } = await this.db
          .from('products')
          .update({
            stock_quantity: Number(product.stock_quantity) - item.quantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);
        if (updateError) throw new Error(`The sale was saved but stock could not be updated for "${item.name}": ${updateError.message}`);
      }

      const saved = await this.getSale(inserted.id as string);
      if (!saved) throw new Error('The sale was saved but could not be loaded.');
      return saved;
    } catch (fallbackError) {
      const detail = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`Checkout failed. Database function error: ${rpcMessage}. Fallback error: ${detail}`);
    }
  }

  /* =========================
     IMAGE UPLOAD
  ========================= */

  async uploadProductImage(
    productId: string,
    file: Blob
  ): Promise<string> {
    if (!productId) {
      throw new Error(
        'Product ID is missing.'
      );
    }

    if (!file || file.size <= 0) {
      throw new Error(
        'Image file is empty.'
      );
    }

    /*
     * IMPORTANT:
     *
     * Supabase Storage bucket:
     * product-images
     *
     * File path:
     * product-id/random-id.jpg
     */
    const path =
      `${productId}/${makeId()}.jpg`;

    const storage =
      this.db.storage.from(
        'product-images'
      );

    const { error: uploadError } =
      await storage.upload(
        path,
        file,
        {
          contentType:
            'image/jpeg',
          cacheControl:
            '3600',
          upsert: false,
        }
      );

    if (uploadError) {
      console.error(
        'Supabase Storage upload error:',
        uploadError
      );

      throw new Error(
        `Image upload failed: ${uploadError.message}`
      );
    }

    const {
      data: publicData,
    } = storage.getPublicUrl(path);

    const publicUrl =
      publicData?.publicUrl;

    if (!publicUrl) {
      throw new Error(
        'Could not create public image URL.'
      );
    }

    const { error: updateError } =
      await this.db
        .from('products')
        .update({
          image_url: publicUrl,
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', productId);

    if (updateError) {
      throw new Error(
        `Could not save product image URL: ${updateError.message}`
      );
    }

    return publicUrl;
  }

  async uploadQrCode(file: Blob): Promise<string> {
    if (!file || file.size <= 0) throw new Error('QR image is empty.');
    const path = `qr/${makeId()}.png`;
    const storage = this.db.storage.from('product-images');
    const { error } = await storage.upload(path, file, { contentType: file.type || 'image/png', cacheControl: '3600', upsert: false });
    if (error) throw new Error(`QR upload failed: ${error.message}`);
    const { data } = storage.getPublicUrl(path);
    if (!data?.publicUrl) throw new Error('Could not create QR image URL.');
    return data.publicUrl;
  }

  /* =========================
     SETTINGS
  ========================= */

  async getSettings(): Promise<Settings> {
    const { data, error } =
      await this.db
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

    if (error) throw error;

    if (!data) {
      return {
        storeName: 'YN POS',
        currency: 'USD',
        taxEnabled: false,
        taxPercent: 10,
        sound: true,
        vibration: true,
        scannerQuality: 'fast',
        theme: 'dark',
        allowNegativeStock: false,
      };
    }

    return {
      storeName:
        data.store_name,
      currency:
        data.currency,
      taxEnabled:
        data.tax_enabled,
      taxPercent:
        Number(data.tax_percent),
      sound:
        data.sound,
      vibration:
        data.vibration,
      scannerQuality:
        data.scanner_quality ===
        'balanced'
          ? 'balanced'
          : 'fast',
      theme:
        data.theme,
      allowNegativeStock:
        data.allow_negative_stock,
      qrCodeUrl: data.qr_code_url || undefined,
    };
  }

  async updateSettings(
    settings: Settings
  ): Promise<Settings> {
    const { error } =
      await this.db
        .from('settings')
        .upsert({
          id: 1,
          store_name:
            settings.storeName,
          currency:
            settings.currency,
          tax_enabled:
            settings.taxEnabled,
          tax_percent:
            settings.taxPercent,
          sound:
            settings.sound,
          vibration:
            settings.vibration,
          scanner_quality:
            settings.scannerQuality,
          theme:
            settings.theme,
          allow_negative_stock:
            settings.allowNegativeStock,
          qr_code_url:
            settings.qrCodeUrl || null,
        });

    if (error) throw error;

    return settings;
  }
}

/* =========================
   ACTIVE REPOSITORY
========================= */

export const repository: Repository =
  supabaseConfigured && supabase
    ? new SupabaseRepository(supabase)
    : new DemoRepository();

