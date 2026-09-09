export interface BarcodeScanner{start():Promise<void>;stop():Promise<void>;isSupported():Promise<boolean>;onBarcodeDetected(cb:(barcode:string)=>void):()=>void}
