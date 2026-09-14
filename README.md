# YN POS
A mobile-first retail POS built with React + Vite + TypeScript, Supabase, browser camera scanning, Capacitor and a native Swift/VisionKit scanner bridge.

## Install
```bash
npm install
npm run dev
```

## Production build
```bash
npm run build
```

## Supabase
Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never put a service-role key in the frontend. Run `supabase/migrations/001_init.sql` in Supabase SQL Editor. The SQL creates products, categories, sales, sale_items, settings, RLS policies and a transactional `create_sale` function that allocates receipt numbers and decrements stock.

Without Supabase variables, YN POS automatically runs in DEMO MODE using a repository with localStorage and sample retail products.

## Web scanner
The web implementation uses the browser camera and ZXing for continuous live barcode detection. It does not upload photos. Serve the app over HTTPS in production because camera access requires a secure context.

## Capacitor / native iOS
The repository contains the Swift source for `YNBarcodeScanner`, which uses VisionKit `DataScannerViewController` rather than a fake JavaScript implementation. On a Mac:
```bash
npm install
npm run build
npx cap add ios
npx cap sync
npx cap open ios
```
Configure the bundle/signing team in Xcode, grant camera access, and run on a supported physical iPhone. DataScanner availability is checked at runtime. Add `NSCameraUsageDescription` to the iOS target's Info.plist (the provided native source documents the required permission).

If your Capacitor version has generated an iOS project, copy `ios/App/App/Plugins/YNBarcodeScanner/YNBarcodeScanner.swift` into the App target and register the plugin with the generated Capacitor bridge. The Swift class is intentionally real VisionKit code; it is not a placeholder.

## Render
Create a Render Static Site connected to this repository.
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Add SPA rewrite: `/*` -> `/index.html`
- Add the two `VITE_SUPABASE_*` environment variables if using Supabase.

## Vercel / Netlify / Cloudflare Pages
Deploy as a static Vite site with SPA fallback to `index.html` and the same environment variables.

## iPhone web / PWA
Open the deployed HTTPS URL in Safari, allow camera access, and optionally use Safari's Add to Home Screen. PWA installation does not bypass Safari camera/security restrictions.

## Native iOS requirements
Xcode, an Apple Developer account for device/TestFlight signing, CocoaPods if required by the Capacitor project, and a supported iPhone are required. Archive from Xcode for TestFlight/App Store.


## Supabase setup (quick start)

1. Create a project in Supabase.
2. Open **SQL Editor** and run `supabase/migrations/001_init.sql`.
3. Copy `.env.example` to `.env`.
4. Put your Supabase **Project URL** and **Publishable/anon key** in `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Run `npm install` then `npm run dev`.

When both variables are present, the app uses Supabase automatically and the status changes from `DEMO MODE` to `ONLINE`. Without them, it keeps using localStorage demo data.

**Important:** the included RLS policies intentionally allow the anon browser key to read/write POS data because this version has no login. For a real multi-user/production POS, add Supabase Auth and replace the public policies with authenticated/user-scoped policies.

## YN POS V2
This version adds the management-oriented UX shown in the YN POS concept: Dashboard, POS, Scanner, Products, Categories, Inventory, Customers, Suppliers, Employees, Cash Drawer, Reports, Receipts, and Settings. The mobile navigation prioritizes Home, Sale, Scan, Receipts, and More.

Product images can be taken with the phone camera or selected from the device. Images are resized and background-removal is attempted in-browser; the processed image is uploaded only after the product has a database ID.
