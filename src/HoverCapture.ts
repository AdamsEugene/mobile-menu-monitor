import Specifics from "./shared/Specifics";

interface HoverPathItem {
  element: HTMLElement;
  rect: DOMRect;
}

class HoverCapture {
  private hoverPath: HoverPathItem[] = [];
  private hoverTimeout: number | null = null;
  // private navElement: HTMLElement | null = null;
  private headerElement: HTMLElement | null = null;
  private dom: Document;
  private isReplaying: boolean = false;
  private siteSpecifics: Specifics;
  private isProdMode = false;

  constructor() {
    if (!this.isProdMode) console.log("Mobile HoverCapture initialized");
  }

  private excludeElementsMap: Map<string, string> = new Map([
    ["a", "ui-hover"],
  ]);

  private classesToHide = [".overlay.is-visible"];

  private selectorClasses = ".popout--sort, .header-main-bar";
  private selectorIds = "menu-drawer";

  init(containerId: string = "recordingPlayer1"): void {
    this.isProdMode = this.getRedirectType() === "dashboard";
    const document = window.document;
    const container = document.getElementById(containerId);
    this.dom =
      (container instanceof HTMLIFrameElement &&
        container.contentWindow?.document) ||
      document;

    this.siteSpecifics = new Specifics(this.dom);

    const navById = this.dom.getElementById(this.selectorIds);
    const navByClass = this.selectorClasses
      ? (this.dom.querySelector(this.selectorClasses) as HTMLElement)
      : null;

    const header = navById || navByClass;
    if (!header) {
      if (!this.isProdMode)
        console.error("Error: No visible header element found.");
      return;
    }

    this.headerElement = navById || navByClass;
    console.log(this.headerElement);

    if (this.headerElement) {
      this.attachReopenMenuListener();
      if (!this.isProdMode) console.log("container: ", this.headerElement);

      this.headerElement.addEventListener(
        "mouseover",
        this.setupHoverCapture.bind(this)
      );
      this.headerElement.addEventListener(
        "mouseout",
        this.stopHoverCapture.bind(this)
      );
    }
  }

  private attachReopenMenuListener(): void {
    document.addEventListener("reopen-menu", this.handleReopenMenu.bind(this));
    document.addEventListener("close-menu", this.handleCloseMenu.bind(this));
  }

  private containsTextContent(element: Element | null, text: string): boolean {
    if (!element) return false;

    return Array.from(element.childNodes).some((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent?.includes(text) ?? false;
      }
      return this.containsTextContent(node as Element, text);
    });
  }

  private setupHoverCapture(event: MouseEvent): void {
    // Don't capture new hover states during replay
    if (this.isReplaying) {
      return;
    }

    if (this.hoverTimeout !== null) {
      clearTimeout(this.hoverTimeout);
    }

    this.hoverTimeout = window.setTimeout(() => {
      console.log("started...");
      this.captureHoverState(event.target as HTMLElement);
    }, 1000);
  }

  private stopHoverCapture(event: MouseEvent) {
    if (
      this.headerElement &&
      !this.headerElement.contains(event.relatedTarget as any)
    ) {
      if (this.hoverTimeout !== null) {
        console.log("stop capturing");
        clearTimeout(this.hoverTimeout);
      }
    }
  }

  private captureHoverState(target: HTMLElement): void {
    let newPath: HoverPathItem[] = [];
    let element: HTMLElement | null = target;

    while (element && element !== this.headerElement) {
      if (!this.shouldExcludeElement(element)) {
        newPath.unshift({
          element: element,
          rect: element.getBoundingClientRect(),
        });
      }
      element = element.parentElement;
    }

    if (this.isPathContainedOrExtended(this.hoverPath, newPath)) {
      this.hoverPath = this.mergeHoverPaths(this.hoverPath, newPath);
    } else {
      this.hoverPath = newPath;
    }

    // if (!this.isProdMode)
    console.log("Hover state captured for:", this.hoverPath);
  }

  private shouldExcludeElement(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    const className = this.excludeElementsMap.get(tagName);

    if (className && element.classList.contains(className)) {
      return true;
    }
    return false;
  }

  private isPathContainedOrExtended(
    existingPath: HoverPathItem[],
    newPath: HoverPathItem[]
  ): boolean {
    if (existingPath.length === 0) return false;
    const minLength = Math.min(existingPath.length, newPath.length);
    for (let i = 0; i < minLength; i++) {
      if (existingPath[i].element !== newPath[i].element) {
        return i > 0;
      }
    }
    return true;
  }

  private mergeHoverPaths(
    existingPath: HoverPathItem[],
    newPath: HoverPathItem[]
  ): HoverPathItem[] {
    const commonLength = existingPath.findIndex(
      (item, index) => item.element !== newPath[index]?.element
    );
    return commonLength === -1
      ? newPath
      : [
          ...existingPath.slice(0, commonLength),
          ...newPath.slice(commonLength),
        ];
  }

  replay(): void {
    if (this.hoverPath.length > 0) {
      this.isReplaying = true; // Set flag before replay

      const replayPromise = new Promise<void>((resolve) => {
        let completed = 0;
        this.hoverPath.forEach((item, index) => {
          setTimeout(() => {
            this.simulateHover(item.element, item.rect);
            completed++;
            if (completed === this.hoverPath.length) {
              resolve();
            }
          }, index * 1);
        });
      });

      // Reset the flag after replay completes
      replayPromise.then(() => {
        setTimeout(() => {
          this.isReplaying = false;
        }, 100); // Small buffer after last replay action
      });
    } else {
      if (!this.isProdMode) console.log("No hover state captured yet");
    }
    if (!this.isProdMode) console.timeEnd("replay all changes");
  }

  private simulateHover(element: HTMLElement, rect: DOMRect): void {
    console.log("element: ", element);

    if (!element) {
      if (!this.isProdMode) console.error("Element not found");
      return;
    }

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const eventTypes = ["mouseenter", "mouseover", "mousemove", "focus"];

    eventTypes.forEach((eventType) => {
      const event = new MouseEvent(eventType, {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: centerX,
        clientY: centerY,
        screenX: centerX,
        screenY: centerY,
        which: 1,
        buttons: 1,
        relatedTarget: element.parentElement,
      });

      element.dispatchEvent(event);
    });

    // Simulate click for details elements
    if (
      this.getIdSite() === "2761" ||
      (element.tagName.toLowerCase() === "details" &&
        +this.getIdSite() === 1485)
    ) {
      if (!this.isProdMode) console.log("Simulating click on details element");
      const clickEvent = new MouseEvent("click", {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: centerX,
        clientY: centerY,
        screenX: centerX,
        screenY: centerY,
        which: 1,
        buttons: 1,
        button: 0, // Left mouse button
      });
      element.dispatchEvent(clickEvent);
      (element as HTMLDetailsElement).open = !(element as HTMLDetailsElement)
        .open;
    }

    let count = 0;
    function handleToggle() {
      count += 1;
      if (!(element as HTMLDetailsElement).open) {
        element.setAttribute("open", ""); // Prevent closing
        element.classList.add("is-open");
        count > 1 && element.removeEventListener("toggle", handleToggle);
      }
    }
    if (element.tagName.toLowerCase() === "details") {
      (element as HTMLDetailsElement).open = true;
      element.setAttribute("open", "true");
      element.classList.add("is-open");
      element.addEventListener("toggle", handleToggle);
    }

    this.siteSpecifics.handleRingsMenu(element);
    this.siteSpecifics.handleKnockaroundMenu(element);

    console.log(element);

    if (!this.isProdMode) console.log("Simulated hover for:", element);
  }

  private clear(): void {
    if (this.hoverPath.length > 0) {
      this.hoverPath
        .slice()
        .reverse()
        .forEach((item, index) => {
          if (item.element.tagName.toLowerCase() === "details") {
            item.element.removeAttribute("open");
            item.element.classList.remove("is-open");
          }
          setTimeout(() => {
            const events: string[] = ["mouseleave", "mouseout", "blur"];
            events.forEach((eventType) => {
              const event = new MouseEvent(eventType, {
                view: window,
                bubbles: true,
                cancelable: true,
              });
              item.element.dispatchEvent(event);
            });
            console.log("Cleared hover state for:", item.element);
          }, index * 10);

          this.siteSpecifics.handleRingsMenuClear(item.element);
          this.siteSpecifics.handleKnockaroundMenuClear(item.element);
        });
      this.hoverPath = [];
    } else {
      if (!this.isProdMode) console.log("No hover state to clear");
    }

    this.classesToHide.forEach((cls) => {
      this.dom.querySelectorAll(cls).forEach((cl: HTMLElement) => {
        if (cl) {
          cl.style.opacity = "0";
          cl.style.visibility = "hidden";
        }
      });
    });
  }

  public replayChanges() {
    this.replay();
  }

  public clearChanges() {
    this.clear();
  }

  private handleReopenMenu(event: Event): void {
    if (!this.isProdMode) console.log("Reopening menu");
    this.replayChanges();
  }

  private handleCloseMenu(event: Event): void {
    if (!this.isProdMode) console.log("Closing menu");
    this.clearChanges();
  }

  public reopenMenu(): void {
    document.dispatchEvent(new CustomEvent("reopen-menu"));
  }

  public closeActiveMenu(): void {
    document.dispatchEvent(new CustomEvent("close-menu"));
  }

  private getIdSite(): string {
    const url = window.location.href;

    const regex = /\/heatmaps\/([^\/]+)/;
    const match = url.match(regex);

    return match[1];
  }

  private getRedirectType(): "dashboard" | "locala" | "deves" | "dever" {
    const url = new URL(window.location.href);
    const hostname = url.hostname;
    if (hostname.includes("localhost")) return "locala";
    if (hostname.includes("dashboard")) return "dashboard";
    if (hostname.includes("early-release")) return "dever";
    if (hostname.includes("earlystage")) return "deves";
    return "dashboard";
  }
}

function createInstance<T>(
  constructor: new (...args: any[]) => T,
  ...args: any[]
): T {
  return new constructor(...args);
}

const myClassInstance: HoverCapture = createInstance(HoverCapture);

export type HoverCaptureType = typeof myClassInstance;

export default HoverCapture;
