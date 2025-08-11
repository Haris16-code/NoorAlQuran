async function loadResources() {
  // Load HTML first
  const htmlResp = await fetch('https://raw.githubusercontent.com/Haris16-code/NoorAlQuran/main/index.html');
  const htmlText = await htmlResp.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');

  // Replace current body content with fetched body content
  document.body.innerHTML = doc.body.innerHTML;

  // Load and inject CSS
  const cssResp = await fetch('https://raw.githubusercontent.com/Haris16-code/NoorAlQuran/main/style.css');
  const cssText = await cssResp.text();
  const styleTag = document.createElement('style');
  styleTag.textContent = cssText;
  document.head.appendChild(styleTag);

  // Load and inject JS after HTML is loaded into DOM
  const jsResp = await fetch('https://raw.githubusercontent.com/Haris16-code/NoorAlQuran/main/script.js');
  const jsText = await jsResp.text();
  const scriptTag = document.createElement('script');
  scriptTag.textContent = jsText;
  document.body.appendChild(scriptTag);
}

window.onload = loadResources;
