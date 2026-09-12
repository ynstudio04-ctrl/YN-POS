# YN POS – People, Inventory & Animations

## Supabase
1. Open Supabase SQL Editor.
2. Run `supabase/migrations/005_contacts_inventory.sql`.
3. Make sure your `.env` contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Run `npm install` then `npm run build`.

## New features
- Customers, Suppliers and Workers save to Supabase when Supabase is configured.
- Inventory has a separate stock adjustment workflow; Product editing cannot change stock.
- Stock adjustments are recorded in `stock_movements`.
- Product image processing has a full-screen animated processing state.
- Inventory update uses animated, live stock preview.

## GitHub
After extracting this project:
```cmd
cd /d "YOUR\PROJECT\FOLDER"
git init
git branch -M main
git remote add origin https://github.com/ynstudio04-ctrl/YN-POS.git
git add .
git commit -m "Improve inventory and people management"
git push -u origin main
```
