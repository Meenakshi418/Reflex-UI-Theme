function applyFont(font) {
    const style = document.createElement("style");

    style.innerHTML = `
    * {
      font-family: '${font}' !important;
    }
  `;

    document.head.appendChild(style);
}