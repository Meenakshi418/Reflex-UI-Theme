function applyTheme(color) {
    const style = document.createElement("style");

    style.innerHTML = `
    html, body, * {
      background-color: ${color} !important;
      color: #111 !important;
    }
  `;

    document.head.appendChild(style);

    document.body.style.transition = "all 0.4s ease";

    // readability improvements
    document.body.style.lineHeight = "1.8";
    document.body.style.fontSize = "18px";

    document.getElementById("themeOverlay").remove();
}