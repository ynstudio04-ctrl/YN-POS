import type {Product,Sale,Settings} from '../types';
export const demoProducts:Product[]=[
{id:'p1',name:'Coca-Cola 330ml',barcode:'5449000000996',sku:'CC330',category:'Drinks',price:0.75,stock:42},
{id:'p2',name:"Lay's Classic",barcode:'8936000961006',sku:'LAYS01',category:'Snacks',price:1.25,stock:18},
{id:'p3',name:'Mineral Water',barcode:'8850389100014',sku:'W500',category:'Drinks',price:0.50,stock:60},
{id:'p4',name:'Oreo',barcode:'7622210449283',sku:'OREO01',category:'Snacks',price:1.10,stock:24},
{id:'p5',name:'Nescafé Latte',barcode:'7613036954214',sku:'NESLAT',category:'Drinks',price:1.75,stock:15},
{id:'p6',name:'Instant Noodles',barcode:'8934563123456',sku:'NOOD01',category:'Groceries',price:0.80,stock:31},
{id:'p7',name:'Chocolate Bar',barcode:'4008400402926',sku:'CHOC01',category:'Snacks',price:1.50,stock:12}
];
export const defaultSettings:Settings={storeName:'YN POS',currency:'USD',taxEnabled:false,taxPercent:10,sound:true,vibration:true,scannerQuality:'fast',theme:'dark',allowNegativeStock:false};
export const loadProducts=()=>JSON.parse(localStorage.getItem('yn_products')||'null')||demoProducts;
export const saveProducts=(p:Product[])=>localStorage.setItem('yn_products',JSON.stringify(p));
export const loadSales=():Sale[]=>JSON.parse(localStorage.getItem('yn_sales')||'[]');
export const saveSales=(s:Sale[])=>localStorage.setItem('yn_sales',JSON.stringify(s));
export const loadSettings=():Settings=>({...defaultSettings,...JSON.parse(localStorage.getItem('yn_settings')||'{}')});
export const saveSettings=(s:Settings)=>localStorage.setItem('yn_settings',JSON.stringify(s));
