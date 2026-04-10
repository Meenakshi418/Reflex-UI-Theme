function showThemeSelector() {
  const container = document.createElement("div");

  container.innerHTML = `
    <div id="themeOverlay">
      <div id="themeBox">

        <h2>⚡ Calm Mode Activated</h2>
        <p class="subtitle">Optimizing your experience...</p>

        <div class="section">
          <p>🧠 Choose Font</p>

          <button class="fontBtn" data-font="Comic Sans MS" style="font-family:'Comic Sans MS'">Comic Sans</button>
          
          <button class="fontBtn" data-font="Georgia" style="font-family:Georgia">Georgia</button>
          
          <button class="fontBtn" data-font="Lucida Handwriting" style="font-family:'Lucida Handwriting'">Lucida Handwriting</button>
        </div>

        <div id="colorSection" class="section" style="display:none;">
          <p>🎨 Choose Background</p>

          <button class="colorBtn" data-color="#e3f2fd">🌊 Calm Blue</button>
          <button class="colorBtn" data-color="#e8f5e9">🌿 Soft Green</button>
          <button class="colorBtn" data-color="#fdf6e3">🧁 Warm Beige</button>
        </div>

        <button id="closeTheme">Skip</button>

      </div>
    </div>
  `;

  document.body.appendChild(container);

  // FONT
  document.querySelectorAll(".fontBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      applyFont(btn.dataset.font);
      document.getElementById("colorSection").style.display = "block";
    });
  });

  // COLOR
  document.querySelectorAll(".colorBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      applyTheme(btn.dataset.color);
    });
  });

  document.getElementById("closeTheme").onclick = () => {
    document.getElementById("themeOverlay").remove();
  };
}