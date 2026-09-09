import {registerPlugin,Capacitor} from '@capacitor/core'; import type {BarcodeScanner} from './scannerTypes';
type Plugin={start():Promise<void>;stop():Promise<void>;isSupported():Promise<{supported:boolean}>;addListener(event:'barcodeDetected',cb:(x:{barcode:string})=>void):Promise<{remove():Promise<void>}>};
const Native=registerPlugin<Plugin>('YNBarcodeScanner');
export class NativeIOSBarcodeScanner implements BarcodeScanner{private remove:undefined|(()=>Promise<void>); async isSupported(){if(Capacitor.getPlatform()!=='ios')return false;try{return (await Native.isSupported()).supported}catch{return false}} async start(){await Native.start()} async stop(){await Native.stop();await this.remove?.()} onBarcodeDetected(cb:(s:string)=>void){Native.addListener('barcodeDetected',e=>cb(e.barcode)).then(x=>this.remove=()=>x.remove());return()=>{this.remove?.()}}}
export const isNativeIOS=()=>Capacitor.getPlatform()==='ios';
