class MenuMonitor {
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private hoverElement: HTMLElement | null = null;
  private hoverDuration: number = 1000;
  private mutations: MutationRecord[] = [];
  private previousMutations: MutationRecord[] = [];
  private isRecording: boolean = false;
  private clonedElements: Map<HTMLElement, HTMLElement> = new Map();
  private previousClonedElements: Map<HTMLElement, HTMLElement> = new Map();
  private menuName: string = "unknown";
  private hiddenElements: Map<HTMLElement, boolean> = new Map();
  private detailsElements: Map<HTMLDetailsElement, boolean> = new Map();
  private invisibleElements: Map<HTMLElement, boolean> = new Map();
  private blurElements: Map<HTMLElement, boolean> = new Map();
  private displayChangedElements: Map<HTMLElement, string> = new Map();
  private detailChangedElements: Map<HTMLDetailsElement, boolean> = new Map();
  private visibilityChangedElements: Map<HTMLElement, string> = new Map();
  private opacityChangedElements: Map<HTMLElement, number> = new Map();
  private navElement: HTMLElement | null = null;
  private headerElement: HTMLElement | null = null;
  private debugMode: boolean;

  constructor(debugMode = false) {
    console.log("MenuMonitor");
    this.debugMode = debugMode;
  }

  private hasSamePositionSize(ele1: HTMLElement, ele2: HTMLElement): boolean {
    const rect1 = ele1.getBoundingClientRect();
    const rect2 = ele2.getBoundingClientRect();

    return (
      rect1.top === rect2.top &&
      rect1.right === rect2.right &&
      rect1.bottom === rect2.bottom &&
      rect1.left === rect2.left
    );
  }

  private isElementVisible(element: Element): boolean {
    const computedStyles = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      computedStyles.display !== "none" &&
      computedStyles.visibility !== "hidden" &&
      rect.width > 10 &&
      rect.height > 30
    );
  }

  private getVisibleNavElements(container: HTMLElement | null): HTMLElement[] {
    if (!container) return [];
    const navElements = container.querySelectorAll("nav");
    if (!navElements) return [container];
    const visibleNavElements = Array.from(navElements).filter((element) => {
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    });
    return visibleNavElements.length > 0 ? visibleNavElements : [container];
  }

  public init(containerId = "recordingPlayer1", debugMode = false) {
    this.debugMode = debugMode;

    const document = window.document;
    const iframe = document.getElementById(containerId) as HTMLIFrameElement;
    const dom = iframe?.contentWindow?.document || document;

    const navById = dom.getElementById("main-nav");
    const navByClass = dom.querySelector(
      ".viair-header-main-links, .site-control__inline-links, .site-header__element.site-header__element--sub, .elementor-widget-nav-menu"
    ) as HTMLElement;

    const headers = dom.querySelectorAll("header");
    const header =
      Array.from(headers).filter((header) =>
        this.isElementVisible(header)
      )[0] ||
      navById ||
      navByClass ||
      this.getFirstVisibleNav(dom);

    if (!header) {
      console.error("Error: No header element found.");
      this.headerElement = null;
      return;
    }

    let currentElement = header as HTMLElement;
    let parentElement = currentElement.parentElement as HTMLElement;

    while (
      parentElement &&
      this.hasSamePositionSize(currentElement, parentElement)
    ) {
      currentElement = parentElement;
      parentElement = currentElement.parentElement as HTMLElement;
    }

    this.headerElement =
      navById || navByClass || currentElement || this.getFirstVisibleNav(dom);

    if (this.headerElement || navById || navByClass) {
      this.attachMutationObserver();
      this.attachHoverListener();
      this.attachReopenMenuListener();
      this.navElement =
        navById ||
        navByClass ||
        this.getFirstVisibleNav(dom) ||
        this.getVisibleNavElements(this.headerElement)[0];
      const detailsElements = this.headerElement?.querySelectorAll("details");
      console.log("nav: ", this.navElement);

      if (this.navElement) {
        this.createHiddenElementsMap(this.navElement);
        this.createInvisibleElementsMap(this.navElement);
        this.createBlurElementsMap(this.navElement);
        if (detailsElements && detailsElements.length > 0) {
          this.createDetailsElementMap(detailsElements);
        }
      }
    }
  }

  private getFirstVisibleNav(dom: Document): HTMLElement | null {
    const navs = dom.querySelectorAll("nav") as NodeListOf<HTMLElement>;

    const navArray = Array.from(navs) as HTMLElement[];

    for (const nav of navArray) {
      const rect = nav.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(nav);

      const isVisible =
        computedStyle.display !== "none" &&
        computedStyle.visibility === "visible";
      const hasChildren = nav.children.length > 0;
      const hasReasonableDimensions = rect.width > 100 && rect.height > 50;

      const hasNavWrapper = nav.querySelector(".nav-wrapper") !== null;
      const hasSkipToContent =
        hasNavWrapper &&
        this.containsTextContent(
          nav.querySelector(".nav-wrapper"),
          "Skip to content"
        );

      if (
        isVisible &&
        hasChildren &&
        hasReasonableDimensions &&
        (!hasNavWrapper || !hasSkipToContent)
      ) {
        return nav as HTMLElement;
      }
    }

    return null;
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

  private createDetailsElementMap(
    detailsElements: NodeListOf<HTMLDetailsElement>
  ) {
    detailsElements.forEach((element) => {
      if (!element.open) this.detailsElements.set(element, element.open);
    });
  }

  private createHiddenElementsMap(container: HTMLElement) {
    container.querySelectorAll("*").forEach((element: HTMLElement) => {
      if (window.getComputedStyle(element).display === "none") {
        this.hiddenElements.set(element, true);
      }
    });
  }

  private createInvisibleElementsMap(container: HTMLElement) {
    container.querySelectorAll("*").forEach((element: HTMLElement) => {
      if (window.getComputedStyle(element).visibility === "hidden") {
        this.invisibleElements.set(element, true);
      }
    });
  }

  private createBlurElementsMap(container: HTMLElement) {
    container.querySelectorAll("*").forEach((element: HTMLElement) => {
      if (parseFloat(window.getComputedStyle(element).opacity) < 1) {
        this.blurElements.set(element, true);
      }
    });
  }

  private attachMutationObserver() {
    if (this.headerElement) {
      const mutationObserver = new MutationObserver(
        this.handleMutations.bind(this)
      );
      const observerConfig = {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true,
      };
      mutationObserver.observe(this.headerElement, observerConfig);
    }
  }

  private attachHoverListener() {
    if (this.headerElement) {
      this.headerElement.addEventListener(
        "mouseover",
        this.handleMouseOver.bind(this)
      );
      this.headerElement.addEventListener(
        "mouseout",
        this.handleMouseOut.bind(this)
      );
    }
  }

  private attachReopenMenuListener() {
    document.addEventListener("reopen-menu", this.handleReopenMenu.bind(this));
    document.addEventListener("close-menu", this.handleCloseMenu.bind(this));
  }

  private isMenuOpen(classList: DOMTokenList): boolean {
    return classList.contains("is-active") || classList.contains("is-expanded");
  }

  private handleMutations(mutationsList: MutationRecord[]) {
    for (const mutation of mutationsList) {
      const targetElement = mutation.target as HTMLElement;

      if (
        !this.isRecording &&
        mutation.type === "attributes" &&
        mutation.attributeName === "class" &&
        this.isMenuOpen((mutation.target as HTMLElement).classList) &&
        this.headerElement!.contains(targetElement)
      ) {
        this.isRecording = true;
        this.mutations = [];
        this.clonedElements.clear();
        this.clonedElements.set(
          targetElement,
          targetElement.cloneNode(true) as HTMLElement
        );
        this.mutations.push(mutation);
        if (this.debugMode) {
          console.log(
            "-------------------------------------------------------------------------------------------------------------------------------"
          );
          console.log("set className - start recording");
          console.log(
            "-------------------------------------------------------------------------------------------------------------------------------"
          );
          console.log(mutation.target);
          console.log((mutation.target as HTMLElement).classList);
          console.log(
            "-------------------------------------------------------------------------------------------------------------------------------"
          );
        }
      } else if (
        this.isRecording &&
        this.headerElement!.contains(targetElement)
      ) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class" &&
          this.isMenuOpen(targetElement.classList) &&
          !this.isMenuOpen((mutation.target as HTMLElement).classList)
        ) {
          if (this.debugMode) {
            console.log(
              "-------------------------------------------------------------------------------------------------------------------------------"
            );
            console.log("set className - stop recording");
            console.log(
              "-------------------------------------------------------------------------------------------------------------------------------"
            );
            console.log(mutation.target);
            console.log((mutation.target as HTMLElement).classList);
            console.log(
              "-------------------------------------------------------------------------------------------------------------------------------"
            );
          }
          this.isRecording = false;
          break;
        }
        if (mutation.attributeName === "class") {
          if (this.debugMode) {
            console.log(
              "-------------------------------------------------------------------------------------------------------------------------------"
            );
            console.log("set className");
            console.log(
              "-------------------------------------------------------------------------------------------------------------------------------"
            );
            console.log(mutation.target);
            console.log((mutation.target as HTMLElement).classList);
            console.log(
              "-------------------------------------------------------------------------------------------------------------------------------"
            );
          }
        } else {
          if (this.debugMode) {
            console.log(
              "-------------------------------------------------------------------------------------------------------------------------------"
            );
            console.log("other mutation", mutation.attributeName);
            console.log(
              "-------------------------------------------------------------------------------------------------------------------------------"
            );
            console.log("target:", mutation.target);
            console.log(mutation);
            console.log(
              "-------------------------------------------------------------------------------------------------------------------------------"
            );
          }
        }
        this.clonedElements.set(
          targetElement,
          targetElement.cloneNode(true) as HTMLElement
        );
        this.mutations.push(mutation);
      }
    }
  }

  private handleMouseOver(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (this.headerElement!.contains(target)) {
      this.hoverElement = target;
      this.startHoverTimer();
    }
  }

  private recordDisplayChanges() {
    this.hiddenElements.forEach((_, element) => {
      const currentDisplay = window.getComputedStyle(element).display;
      if (currentDisplay !== "none") {
        let shouldClearSet = true;
        const keysArray = Array.from(this.displayChangedElements.keys());
        for (let existingElement of keysArray) {
          if (existingElement.contains(element)) {
            shouldClearSet = false;
            break;
          }
        }
        if (shouldClearSet) this.displayChangedElements.clear();
        this.displayChangedElements.set(element, currentDisplay);
      }
    });
    console.log(this.displayChangedElements);
  }

  private recordDetailsChanges() {
    this.detailsElements.forEach((_, element) => {
      if (element.open) {
        this.detailChangedElements.clear();
        this.detailChangedElements.set(element, element.open);
      }
    });
  }

  private recordVisibilityChanges() {
    this.invisibleElements.forEach((_, element) => {
      const visibility = window.getComputedStyle(element).visibility;
      if (visibility !== "hidden") {
        this.visibilityChangedElements.clear();
        this.visibilityChangedElements.set(element, visibility);
      }
    });
  }

  private recordBlurredChanges() {
    this.blurElements.forEach((_, element) => {
      const opacity = parseFloat(window.getComputedStyle(element).opacity);
      if (opacity > 0) {
        let shouldClearSet = true;
        const keysArray = Array.from(this.opacityChangedElements.keys());
        for (let existingElement of keysArray) {
          if (existingElement.contains(element)) {
            shouldClearSet = false;
            break;
          }
        }
        if (shouldClearSet)
          this.opacityChangedElements.clear(),
            this.opacityChangedElements.set(element, opacity);
      }
    });

    console.log(this.opacityChangedElements);
  }

  private handleMouseOut() {
    this.stopHoverTimer();
    this.hoverElement = null;
  }

  private startHoverTimer() {
    this.stopHoverTimer();
    this.hoverTimer = setTimeout(() => {
      if (this.hoverElement) {
        this.recordDisplayChanges();
        this.recordDetailsChanges();
        this.recordVisibilityChanges();
        this.recordBlurredChanges();

        this.menuName = this.hoverElement.innerText || "selected";
        console.log("Capturing mutations now for " + this.menuName + " menu");
        this.dispatchMenuOpenEvent();
        this.previousMutations = [...this.mutations];
        this.previousClonedElements = new Map(this.clonedElements); // Update previousClonedElements only when the hover timer completes
      }

      this.hoverTimer = null;
      this.isRecording = false;
    }, this.hoverDuration);
  }

  private stopHoverTimer() {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
  }

  private dispatchMenuOpenEvent() {
    const menuOpenEvent = new CustomEvent("menu-open", {
      detail: {
        mutations: this.mutations,
      },
    });
    document.dispatchEvent(menuOpenEvent);
    this.isRecording = false;
  }

  private dispatchMenuCloseRequiredEvent() {
    const menuCloseEvent = new CustomEvent("menu-close-required", {
      detail: {
        mutations: this.mutations,
      },
    });
    console.log("dispatchMenuCloseRequiredEvent");
    document.dispatchEvent(menuCloseEvent);
    this.isRecording = false;
  }

  private dispatchHideCloseEvent() {
    const hideCloseEvent = new CustomEvent("hide-close-menu", {
      detail: {
        mutations: this.mutations,
      },
    });
    console.log("dispatchMenuCloseRequiredEvent");
    document.dispatchEvent(hideCloseEvent);
    this.isRecording = false;
  }

  private handleReopenMenu() {
    if (!this.hoverElement) {
      this.reapplyMutations();
    }
  }

  private handleCloseMenu() {
    this.hiddenElements.forEach((_, element) => {
      element.style.removeProperty("display");
    });
    // this.headerElement?.querySelectorAll("details")?.forEach((element) => {
    //   element.removeAttribute("open");
    // });
    this.detailChangedElements.forEach((_, element) => {
      element.removeAttribute("open");
      element.classList.remove("is-open");
      const megaElement = element.querySelector(
        ".mega-menu-content"
      ) as HTMLElement;

      if (megaElement && megaElement.id.startsWith("MegaMenu-Content-")) {
        megaElement.style.transform = "scaleY(0)";
      }
    });
    this.visibilityChangedElements.forEach((_, element) => {
      element.style.removeProperty("visibility");
    });
    this.opacityChangedElements.forEach((_, element) => {
      this.removeCssForNikura(element);
      element.style.removeProperty("opacity");
    });
    this.displayChangedElements.clear();
    this.detailChangedElements.clear();
    this.visibilityChangedElements.clear();
    this.opacityChangedElements.clear();
    this.dispatchHideCloseEvent();
  }

  private reapplyMutations() {
    for (const mutation of this.previousMutations) {
      const targetElement = mutation.target as HTMLElement;
      const clonedElement = this.previousClonedElements.get(targetElement);
      if (clonedElement) {
        switch (mutation.type) {
          case "attributes":
            const attrib = clonedElement.getAttribute(mutation.attributeName!);
            if (this.debugMode) {
              console.log("attribute:", mutation.attributeName, "val:", attrib);
              console.log(targetElement);
            }
            targetElement.setAttribute(mutation.attributeName!, attrib!);
            break;
          case "childList":
            mutation.addedNodes.forEach((node) => {
              const clonedNode = clonedElement.querySelector(
                `[data-node-id="${(node as HTMLElement).getAttribute(
                  "data-node-id"
                )}"]`
              );
              if (clonedNode) {
                targetElement.appendChild(clonedNode.cloneNode(true));
              }
            });
            mutation.removedNodes.forEach((node) => {
              const removedNode = targetElement.querySelector(
                `[data-node-id="${(node as HTMLElement).getAttribute(
                  "data-node-id"
                )}"]`
              );
              if (removedNode) {
                targetElement.removeChild(removedNode);
              }
            });
            break;
          case "characterData":
            targetElement.textContent = clonedElement.textContent;
            break;
        }
      }
    }
    this.reapplyDisplayChanges();
    this.reapplyDetailsChanges();
    this.reapplyVisibilityChanges();
    this.reapplyBlurredChanges();
  }

  private reapplyDisplayChanges() {
    let manualCloseRequired = false;
    this.displayChangedElements.forEach((displayValue, element) => {
      const parent = element.parentElement;
      if (parent && getComputedStyle(parent).display === "none") {
        parent.style.display = displayValue;
      }
      element.style.display = displayValue;
      console.log({ displayValue });

      manualCloseRequired = true;
    });
    if (manualCloseRequired) {
      this.dispatchMenuCloseRequiredEvent();
    }
  }

  private reapplyDetailsChanges() {
    let hasChanges = false;
    let count = 0;
    this.detailChangedElements.forEach((open, element) => {
      function handleToggle() {
        count += 1;
        if (!element.open) {
          console.log("====================================");
          console.log("Prevent detail from closing");
          console.log("====================================");
          element.setAttribute("open", ""); // Prevent closing
          element.classList.add("is-open");
          count > 5 && element.removeEventListener("toggle", handleToggle);
        } else {
          // If you want to perform some action when it opens, you can do that here
          console.log("Details opened");
          // element.removeAttribute("open"); // Prevent closing
          // element.classList.remove("is-open");
        }
      }

      // element.addEventListener("toggle", () => {
      //   if (element.open) {
      //     // If it's opened, you might want to remove the listener now
      //   }
      // });
      const megaElement = element.querySelector(
        ".mega-menu-content"
      ) as HTMLElement;

      if (megaElement && megaElement.id.startsWith("MegaMenu-Content-")) {
        megaElement.style.transform = "scaleY(1)";
      }

      element.setAttribute("open", `${open}`);
      element.setAttribute("aria-expanded", `${open}`);
      element.classList.add("is-open");
      (element as HTMLDetailsElement).open = true;
      element.addEventListener("toggle", handleToggle);
      // Event listener to prevent closing
      // element.addEventListener("toggle", () => {
      //   // if (!element.open) {
      //   console.log("====================================");
      //   console.log("prevent detail from closing");
      //   console.log("====================================");
      //   // element.setAttribute("open", "");
      //   // element.classList.add("is-open");
      //   // }
      // });

      hasChanges = true;
    });
    if (hasChanges) {
      this.dispatchMenuCloseRequiredEvent();
    }
  }

  private reapplyVisibilityChanges() {
    let hasChanges = false;
    this.visibilityChangedElements.forEach(
      (visibility, element: HTMLElement) => {
        element.style.visibility = visibility;
        hasChanges = true;
      }
    );
    if (hasChanges) {
      this.dispatchMenuCloseRequiredEvent();
    }
  }

  private reapplyBlurredChanges() {
    let hasChanges = false;
    this.opacityChangedElements.forEach((opacity, element: HTMLElement) => {
      element.style.opacity = `${opacity}`;
      element.style.setProperty("transform", "scale(1)", "important");

      // console.log(element);
      this.applyCssForNikura(element);
      hasChanges = true;
    });
    this.adjustMenuMaxHeight();
    if (hasChanges) {
      this.dispatchMenuCloseRequiredEvent();
    }
  }

  private removeIsActiveClass() {
    const activeElements = this.headerElement?.querySelectorAll(
      ".is-active, .is-expanded"
    );
    activeElements?.forEach((element) => {
      element.classList.remove("is-active", "is-expanded");
    });
  }

  private adjustMenuMaxHeight() {
    const dropdowns = this.navElement?.querySelectorAll(".rtnu-nav__dropdown");
    dropdowns?.forEach((dropdown: HTMLElement) => {
      dropdown.style.maxHeight = "500px";
    });
    const mainContainers = this.navElement?.querySelectorAll(
      ".mega-menu__main-container"
    );
    mainContainers?.forEach((container: HTMLElement) => {
      container.style.maxHeight = "800px";
      container.style.paddingTop = "48px";
      container.style.paddingBottom = "48px";
      container.style.cursor = "auto";
      container.style.height = "100%";
    });
  }

  private applyCssForNikura(element: HTMLElement) {
    // Select the container element
    const container = element.querySelector(
      ".bg-white.transition.ease-out.duration-700.delay-200"
    ) as HTMLElement;

    if (container) {
      if (!container.id) container.id = "container-from-adams";
      const parentElement = container.parentElement as HTMLElement;
      if (parentElement) {
        parentElement.style.setProperty("opacity", "1", "important");
      }

      // Set container transform and opacity
      container.style.setProperty("transform", "translateY(0)", "important");
      container.style.setProperty("opacity", "1", "important");

      // Select the <ul> inside the container and apply the specified styles
      const ulElement = container.querySelector("ul") as HTMLElement;
      if (ulElement) {
        if (!ulElement.id) ulElement.id = "ulElement";
        ulElement.style.setProperty("opacity", "1", "important");
        ulElement.style.setProperty("pointer-events", "auto", "important");
        ulElement.style.setProperty(
          "transition",
          "opacity 0.1s ease-out 0.2s, pointer-events 0.1s ease-out 0.2s",
          "important"
        );
        ulElement.style.setProperty("padding-top", "40px", "important");
        ulElement.style.setProperty("padding-bottom", "80px", "important");
        ulElement.style.setProperty("font-size", "12px", "important");
        ulElement.style.setProperty("min-height", "520px", "important");
        ulElement.style.setProperty("width", "100%", "important");

        const innerElement = ulElement.querySelector(
          ".transition.duration-700.ease-out.h-full.delay-800"
        ) as HTMLElement;

        // Apply the new styles to the innerElement
        if (innerElement) {
          innerElement.style.setProperty("opacity", "1", "important");
          innerElement.style.setProperty(
            "transform",
            "translateX(0)",
            "important"
          );
          innerElement.style.setProperty(
            "transition",
            "transform 0.1s ease-out 0.5s",
            "important"
          );
          innerElement.style.setProperty("height", "100%", "important");

          const opacityElement = innerElement.querySelector(
            ".opacity-0.transition.duration-1000.delay-500.h-full.relative"
          ) as HTMLElement;

          // Set opacity to 1
          if (opacityElement) {
            opacityElement.style.setProperty("opacity", "1", "important");
          }
        }
      }

      const ulElementById = document.getElementById("ulElement");
      const containerElementById = document.getElementById(
        "container-from-adams"
      );

      if (ulElementById || containerElementById) {
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        let styles = "";
        if (ulElementById) {
          styles += `#ulElement { opacity: 1 !important;}`;
        }
        if (containerElementById) {
          styles += `#container-from-adams {opacity: 1 !important;}`;
        }
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);
      }
    }
  }

  private removeCssForNikura(element: HTMLElement) {
    // Select the container element
    const container = element.querySelector(
      ".bg-white.transition.ease-out.duration-700.delay-200"
    ) as HTMLElement;

    if (container) {
      const parentElement = container.parentElement as HTMLElement;
      if (parentElement) {
        parentElement.style.removeProperty("opacity");
      }

      // Remove inline styles from the container
      container.style.removeProperty("transform");
      container.style.removeProperty("opacity");

      // Select the <ul> inside the container and remove the specified styles
      const ulElement = container.querySelector("ul") as HTMLElement;
      if (ulElement) {
        ulElement.style.removeProperty("opacity");
        ulElement.style.removeProperty("pointer-events");
        ulElement.style.removeProperty("transition");
        ulElement.style.removeProperty("padding-top");
        ulElement.style.removeProperty("padding-bottom");
        ulElement.style.removeProperty("font-size");
        ulElement.style.removeProperty("min-height");
        ulElement.style.removeProperty("width");

        // Remove styles from the inner element if it exists
        const innerElement = ulElement.querySelector(
          ".transition.duration-700.ease-out.h-full.delay-800"
        ) as HTMLElement;

        if (innerElement) {
          innerElement.style.removeProperty("opacity");
          innerElement.style.removeProperty("transform");
          innerElement.style.removeProperty("transition");
          innerElement.style.removeProperty("height");

          // Remove opacity from the nested opacity element if present
          const opacityElement = innerElement.querySelector(
            ".opacity-0.transition.duration-1000.delay-500.h-full.relative"
          ) as HTMLElement;

          if (opacityElement) {
            opacityElement.style.removeProperty("opacity");
          }
        }
      }

      // Remove the dynamically added styles from the <style> tag if it exists
      const styleTag = document.querySelector("style#dynamic-styles");
      if (styleTag) {
        styleTag.remove();
      }
    }
  }

  public reopenMenu() {
    document.dispatchEvent(new CustomEvent("reopen-menu", { detail: true }));
  }

  public closeMenu() {
    document.dispatchEvent(new CustomEvent("close-menu", { detail: true }));
  }

  public closeActiveMenu() {
    this.removeIsActiveClass();
    this.handleCloseMenu();
  }
}

function createInstance<T>(
  constructor: new (...args: any[]) => T,
  ...args: any[]
): T {
  return new constructor(...args);
}

const myClassInstance: MenuMonitor = createInstance(MenuMonitor);

export type MenuMonitorType = typeof myClassInstance;

export default MenuMonitor;
