const puppeteer = require("puppeteer-core");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:8081";

const t0 = Date.now();
function log(m) {
  console.log(`[+${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    defaultViewport: { width: 430, height: 900 },
    protocolTimeout: 60000,
    args: ["--no-sandbox", "--disable-gpu", "--disable-background-timer-throttling", "--enable-logging"],
  });
  const page = await browser.newPage();
  page.on("console", (m) => log(`[console:${m.type()}] ${m.text().slice(0, 200)}`));
  page.on("pageerror", (e) => log(`[pageerror] ${e.message.slice(0, 300)}`));

  log("goto /auth");
  await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  log("achar #email");
  await page.waitForSelector("#email", { timeout: 30_000, visible: true });
  await page.type("#email", "batalha1@udgtest.com");
  await page.type("#password", "UDG@Teste2026");
  log("clicar Entrar");
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("button"));
    const b = els.find((x) => x.textContent && x.textContent.trim().includes("Entrar"));
    if (b) b.click();
  });
  log("clicado — aguardando navegação");

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    let url = "?", state = "?", txt = "";
    try {
      const info = await page.evaluate(() => ({
        url: location.pathname,
        state: document.readyState,
        txt: (document.body && document.body.innerText || "").slice(0, 250).replace(/\n/g, " | "),
      }));
      url = info.url;
      state = info.state;
      txt = info.txt;
    } catch (e) {
      log(`evaluate FALHOU: ${e.message.slice(0, 120)}`);
      try {
        await page.screenshot({ path: "C:\\Users\\PODERO~1\\AppData\\Local\\Temp\\opencode\\diag-lock.png" });
        log("screenshot salvo diag-lock.png");
      } catch {}
      break;
    }
    log(`url=${url} readyState=${state} txt="${txt.slice(0, 180)}"`);
    if (!url.startsWith("/auth")) {
      await page.screenshot({ path: "C:\\Users\\PODERO~1\\AppData\\Local\\Temp\\opencode\\diag-logado.png" });
      log("SESSAO OK — app carregado");
      break;
    }
  }
  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error("ERRO FATAL:", e.message);
  process.exit(1);
});