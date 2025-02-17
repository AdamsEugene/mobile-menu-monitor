export default class Specifics {
  private dom: Document;

  constructor(dom: Document) {
    this.dom = dom;
  }

  private setStyle(
    element: HTMLElement,
    styles: { [key: string]: string },
    notImportant?: boolean
  ) {
    for (const [property, value] of Object.entries(styles)) {
      if (notImportant) element.style.setProperty(property, value);
      else element.style.setProperty(property, value, "important");
    }
  }

  private removeStyle(element: HTMLElement, styles: string[]) {
    styles.forEach((property) => {
      element.style.removeProperty(property);
    });
  }

  private getMenuContent(
    element: HTMLElement,
    selector: string
  ): HTMLElement | null {
    return element.querySelector(selector) as HTMLElement;
  }

  public handleRingsMenu(element: HTMLElement): void {
    if (element.classList.contains("popout")) {
      const followMenuContent = this.getMenuContent(element, ".popout-list");
      if (followMenuContent) {
        this.setStyle(followMenuContent, {
          width: "200px",
          visibility: "visible",
          "pointer-events": "all",
        });
      }
    }
  }

  public handleKnockaroundMenu(element: HTMLElement): void {
    if (element.classList.contains("header-links")) {
      const followMenuContent = this.getMenuContent(
        element,
        ".header-links-wrapper"
      );
      if (followMenuContent) {
        this.setStyle(followMenuContent, {
          transform: "translate(0)",
          "pointer-events": "all",
        });
      }
    }
  }

  public handleRingsMenuClear(element: HTMLElement): void {
    if (element.classList.contains("popout")) {
      const followMenuContent = this.getMenuContent(element, ".popout-list");
      if (followMenuContent) {
        this.removeStyle(followMenuContent, [
          "width",
          "visibility",
          "pointer-events",
        ]);
      }
    }
  }

  public handleKnockaroundMenuClear(element: HTMLElement): void {
    if (element.classList.contains("header-links")) {
      const followMenuContent = this.getMenuContent(
        element,
        ".header-links-wrapper"
      );
      if (followMenuContent) {
        this.removeStyle(followMenuContent, ["transform", "pointer-events"]);
      }
    }
  }
}
