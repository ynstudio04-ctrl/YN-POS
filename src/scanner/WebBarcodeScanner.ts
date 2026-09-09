import { BrowserMultiFormatReader, BarcodeFormat } from '@zxing/browser';
import type { BarcodeScanner } from './scannerTypes';

export class WebBarcodeScanner implements BarcodeScanner {
  private reader = new BrowserMultiFormatReader();
  private stopFn: (() => void) | null = null;
  private cb: ((s: string) => void) | null = null;
  private locked = false;

  constructor(private video: HTMLVideoElement) {}

  async isSupported() {
    return !!navigator.mediaDevices?.getUserMedia;
  }

  onBarcodeDetected(cb: (s: string) => void) {
    this.cb = cb;
    return () => {
      if (this.cb === cb) this.cb = null;
    };
  }

  async start() {
    this.reader = new BrowserMultiFormatReader();
    this.locked = false;

    const controls = await this.reader.decodeFromConstraints(
      {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      this.video,
      (result) => {
        if (result && !this.locked) {
          this.locked = true;
          this.cb?.(result.getText());
          setTimeout(() => (this.locked = false), 1000);
        }
      }
    );

    this.stopFn = () => controls.stop();
  }

  async stop() {
    this.stopFn?.();
    this.stopFn = null;
    this.video.srcObject = null;
  }
}
