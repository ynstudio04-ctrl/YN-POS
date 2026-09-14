export type PaymentMethod='cash'|'card'|'qr';
export type PriceOption={id:string;label:string;price:number};
export type Product={id:string;name:string;barcode?:string;category?:string;price:number;priceOptions?:PriceOption[];stock:number;imageUrl?:string;isActive?:boolean};
export type CartItem=Product&{quantity:number};
export type Sale={id:string;receiptNumber:string;subtotal:number;discount:number;tax:number;total:number;paymentMethod:PaymentMethod;cashReceived?:number;change?:number;createdAt:string;items:CartItem[]};
export type Settings={storeName:string;currency:string;taxEnabled:boolean;taxPercent:number;sound:boolean;vibration:boolean;scannerQuality:'fast'|'balanced';theme:'dark'|'light'|'system';allowNegativeStock:boolean;qrCodeUrl?:string};
