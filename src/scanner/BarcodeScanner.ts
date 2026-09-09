import {isNativeIOS,NativeIOSBarcodeScanner} from './NativeIOSBarcodeScanner'; import {WebBarcodeScanner} from './WebBarcodeScanner';
export function createScanner(video:HTMLVideoElement){return isNativeIOS()?new NativeIOSBarcodeScanner():new WebBarcodeScanner(video)}
