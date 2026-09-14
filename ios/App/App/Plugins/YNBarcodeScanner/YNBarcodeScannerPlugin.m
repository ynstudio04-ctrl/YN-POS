#import <Capacitor/Capacitor.h>

CAP_PLUGIN(YNBarcodeScanner, "YNBarcodeScanner",
           CAP_PLUGIN_METHOD(isSupported, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(start, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(stop, CAPPluginReturnPromise);)
