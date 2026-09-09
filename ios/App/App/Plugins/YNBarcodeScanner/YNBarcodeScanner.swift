import Foundation
import Capacitor
import VisionKit

@objc(YNBarcodeScanner)
public class YNBarcodeScanner: CAPPlugin, DataScannerViewControllerDelegate {
    private var scanner: DataScannerViewController?

    @objc func isSupported(_ call: CAPPluginCall) {
        call.resolve(["supported": DataScannerViewController.isSupported])
    }

    @objc func start(_ call: CAPPluginCall) {
        guard DataScannerViewController.isSupported else { call.reject("VisionKit DataScanner is not supported on this device"); return }
        guard DataScannerViewController.isAvailable else { call.reject("VisionKit DataScanner is currently unavailable"); return }
        let scanner = DataScannerViewController(recognizedDataTypes: [.barcode(symbologies: [.ean13, .ean8, .upce, .code128, .code39, .itf14, .qr])], qualityLevel: .fast, recognizesMultipleItems: false, isHighFrameRateTrackingEnabled: true, isPinchToZoomEnabled: true, isGuidanceEnabled: true, isHighlightingEnabled: true)
        scanner.delegate = self
        self.scanner = scanner
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else { call.reject("Unable to present scanner"); return }
            vc.present(scanner, animated: true) { call.resolve() }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.scanner?.dismiss(animated: true)
            self.scanner = nil
            call.resolve()
        }
    }

    public func dataScanner(_ dataScanner: DataScannerViewController, didTapOn item: RecognizedItem) {}
    public func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
        for item in addedItems {
            if case let .barcode(barcode) = item, let value = barcode.payloadStringValue {
                notifyListeners("barcodeDetected", data: ["barcode": value])
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { dataScanner.dismiss(animated: true) }
                break
            }
        }
    }
    public func dataScanner(_ dataScanner: DataScannerViewController, didUpdate updatedItems: [RecognizedItem], allItems: [RecognizedItem]) {}
    public func dataScanner(_ dataScanner: DataScannerViewController, didRemove removedItems: [RecognizedItem], allItems: [RecognizedItem]) {}
    public func dataScanner(_ dataScanner: DataScannerViewController, becameUnavailableWithError error: DataScannerViewController.ScanningUnavailable) { notifyListeners("scannerUnavailable", data: ["reason": "\(error)"]) }
}
