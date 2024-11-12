import HoverCapture, { HoverCaptureType } from "./HoverCapture";

declare global {
  interface Window {
    MobileMenuMonitor: HoverCaptureType;
  }
}

window.MobileMenuMonitor = new HoverCapture();
window.MobileMenuMonitor.init();
