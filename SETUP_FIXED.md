# YN POS – Fixed Add/Inventory Version

## What was fixed
- **Customers:** Add Customer opens a real form and saves to Supabase.
- **Suppliers:** Add Supplier opens a real form and saves to Supabase.
- **Workers:** Add Worker opens a real form and saves to Supabase.
- The pages still work in local/demo mode if Supabase is not configured.
- **Inventory:** stock is now managed from the Inventory page. Product details no longer contain an editable stock field.
- Stock updates use a database RPC and create a `stock_movements` history row.
- Product-photo processing now shows a full-screen animated processing state while background removal/optimization runs.
- Existing product image upload remains connected to the `product-images` Supabase Storage bucket.

## Supabase setup

### 1. Run the new migration
In Supabase Dashboard → **SQL Editor**, run the contents of:

`supabase/migrations/005_contacts_inventory.sql`

Run it after the existing migrations in this project.

### 2. Make sure the product image bucket exists
The existing migration:

`supabase/migrations/002_product_images.sql`

creates the public `product-images` bucket and its policies. If your database was created from the project's migrations, this is already handled.

### 3. Connect the frontend
Create `.env` in the project root from `.env.example`:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Use the Supabase browser-safe publishable/anon key only. Never put a `service_role` key in this frontend.

### 4. Install and test
From the project folder:

```cmd
npm install
npm run build
```

### 5. Run locally

```cmd
npm run dev
```

## How stock works now
1. Go to **More → Inventory**.
2. Find the product.
3. Click **Update**.
4. Enter `20` to add 20 units, or `-3` to remove 3 units.
5. Add a reason such as `Restock`, `Damaged`, or `Correction`.
6. Click **Update stock**.

The product's stock is updated in Supabase, and the adjustment is recorded in `stock_movements`.

## Important
Do not delete the existing `products.stock_quantity` column. Sales checkout still decreases that column automatically. The new Inventory page is the separate manual stock-adjustment interface.
