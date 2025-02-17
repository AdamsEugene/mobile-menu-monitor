function getAllSimplifiedSelectors() {
  // First, include our simplifyCssSelector function
  function simplifyCssSelector(selector) {
    if (!selector || typeof selector !== "string") {
      return selector;
    }

    const isValidId = (id) => {
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id
        )
      ) {
        return false;
      }
      if (/\d{3,}/.test(id)) {
        return false;
      }
      return true;
    };

    const isTailwindClass = (className) => {
      const tailwindPatterns = [
        /^!/,
        /^\\!/,
        /[\d.]+\//,
        /^-?\\[\d.]+/,
        /^(sm|md|lg|xl|2xl):/,
        /^(hover|focus|active|disabled|visited|group-hover):/,
        /^(p|m)[trblxy]?-/,
        /^(w|h)-/,
        /^(min|max)-(w|h)-/,
        /^(text|bg|border)-/,
        /^(flex|grid)-?/,
        /^(row|col)-/,
        /^(justify|items|content)-/,
        /^(space|gap)-/,
        /^rounded/,
        /^shadow/,
        /^transition/,
        /^transform/,
        /^opacity-/,
        /^z-/,
        /^(static|fixed|absolute|relative|sticky)$/,
        /^(block|inline|inline-block|flex|inline-flex|grid|inline-grid)$/,
        /^(overflow|duration|ease)-/,
        /^(bg|text)-/,
        /^self-/,
        /.*\\[.*\\]/,
        /^\\.?\\d+(\\.\\d+)?$/,
        /^-?\\.?\\d+(\\.\\d+)?$/,
      ];
      return tailwindPatterns.some((pattern) => pattern.test(className));
    };

    if (selector.includes(",")) {
      return selector
        .split(",")
        .map((s) => simplifyCssSelector(s.trim()))
        .filter(Boolean)
        .join(", ");
    }

    selector = selector
      .replace(/\s*>\s*/g, " > ")
      .replace(/\s*\+\s*/g, " + ")
      .replace(/\s*~\s*/g, " ~ ")
      .replace(/\s+/g, " ")
      .trim();

    const parts = selector.match(/[^\s>+~]+|[>+~]/g) || [];

    const simplifiedParts = parts.map((part) => {
      if ([">", "~", "+"].includes(part)) {
        return part;
      }

      const pseudoMatch = part.match(/(:{1,2}[^.#\s\[]+)$/);
      let pseudo = "";
      if (pseudoMatch) {
        pseudo = pseudoMatch[1];
        part = part.slice(0, -pseudo.length);
      }

      const idMatch = part.match(/#([^#.\s\[\]]+)/);
      const classMatches = part.match(/\.([^#.\s\[\]]+)/g);
      const tagMatch = part.match(/^[a-zA-Z0-9-]+/);
      const attributeMatches = part.match(/\[([^\]]+)\]/g);

      let simplified = "";

      if (tagMatch) {
        simplified = tagMatch[0];
      }

      if (idMatch && isValidId(idMatch[1])) {
        return `#${idMatch[1]}${pseudo}`;
      }

      if (classMatches) {
        const validClasses = classMatches
          .map((c) => c.substring(1))
          .filter((c) => !isTailwindClass(c))
          .map((c) => `.${c}`);

        if (validClasses.length > 0) {
          simplified += validClasses.join("");
        }
      }

      if (attributeMatches) {
        const validAttributes = attributeMatches.filter((attr) => {
          const attrName = attr.match(/\[([^=\]]+)/)[1];
          return (
            !attr.includes("tailwind") &&
            !attr.includes("arbitrary") &&
            (!attrName.startsWith("data-") || attr.includes("="))
          );
        });
        simplified += validAttributes.join("");
      }

      simplified += pseudo;
      return simplified || "div";
    });

    let result = simplifiedParts.filter(Boolean).join(" ");
    return result || selector;
  }

  // Function to get a unique selector for an element
  function getUniqueSelector(element) {
    if (!element) return "";
    if (element === document.documentElement) return "html";

    let path = [];
    let current = element;

    while (current) {
      // Skip Shadow DOM boundaries
      if (current.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        current = current.host;
        continue;
      }

      // Stop at the html element
      if (current === document.documentElement) {
        path.unshift("html");
        break;
      }

      let selector = current.nodeName.toLowerCase();

      // Add id if exists and is valid
      if (current.id) {
        selector = "#" + current.id;
      } else {
        // Add classes
        const classes = Array.from(current.classList).join(".");
        if (classes) {
          selector += "." + classes;
        }

        // Add nth-child
        if (current.parentNode) {
          const index =
            Array.from(current.parentNode.children).indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentNode;
    }

    return path.join(" > ");
  }

  // Get all elements
  const allElements = document.getElementsByTagName("*");
  const results = [];

  // Process each element
  for (const element of allElements) {
    const originalSelector = getUniqueSelector(element);
    const simplifiedSelector = simplifyCssSelector(originalSelector);

    // Verify the simplified selector still points to the same element
    const selectedElement = document.querySelector(simplifiedSelector);
    const isValid = selectedElement === element;

    results.push({
      element,
      originalSelector,
      simplifiedSelector,
      isValid,
    });
  }

  // Log results
  console.log("Total elements processed:", results.length);
  results.forEach(
    ({ element, originalSelector, simplifiedSelector, isValid }) => {
      console.log("Element:", element.tagName);
      console.log("Original:", originalSelector);
      console.log("Simplified:", simplifiedSelector);
      console.log("Valid:", isValid);
      console.log("---");
    }
  );

  return results;
}

// You can run this function in the browser console:
// getAllSimplifiedSelectors();
