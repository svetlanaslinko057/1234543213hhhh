import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser, Page } from 'puppeteer';

// Прокси конфигурация
const PROXY_CONFIG = {
  host: '31.6.33.171',
  httpPort: 50100,
  socks5Port: 50101,
  username: 'cryptomagic2x0Ccas',
  password: '989KrcYrU7',
};

@Injectable()
export class BrowserService implements OnModuleInit, OnModuleDestroy {
  private browser: Browser | null = null;
  private pagePool: Page[] = [];
  private readonly maxPages = 5;
  private readonly minInterval = 1500; // 1.5 second between requests
  private lastRequest = 0;
  private useProxy = true; // Включаем прокси по умолчанию
  private browserAvailable = false;

  async onModuleInit() {
    try {
      await this.initBrowser();
      this.browserAvailable = true;
    } catch (error) {
      console.warn(`[BrowserService] Browser init failed (scraping disabled): ${error.message}`);
      this.browserAvailable = false;
    }
  }

  isBrowserAvailable(): boolean {
    return this.browserAvailable;
  }

  async onModuleDestroy() {
    await this.closeBrowser();
  }

  setProxy(enabled: boolean) {
    this.useProxy = enabled;
    console.log(`[BrowserService] Proxy ${enabled ? 'enabled' : 'disabled'}`);
  }

  private async initBrowser(): Promise<void> {
    if (this.browser) return;
    
    // Find Chromium executable - try multiple paths
    const possiblePaths = [
      process.env.CHROMIUM_PATH,
      '/pw-browsers/chromium-1208/chrome-linux/chrome',
      '/root/.cache/ms-playwright/chromium-1208/chrome-linux/chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
    ].filter(Boolean);
    
    let executablePath = possiblePaths[0];
    for (const path of possiblePaths) {
      try {
        const fs = require('fs');
        if (fs.existsSync(path)) {
          executablePath = path;
          break;
        }
      } catch {}
    }
    
    console.log(`[BrowserService] Using Chromium: ${executablePath}`);
    
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920x1080',
      '--single-process',
      '--no-zygote',
      '--disable-blink-features=AutomationControlled',
    ];

    // Добавляем прокси если включено
    if (this.useProxy) {
      const proxyUrl = `http://${PROXY_CONFIG.host}:${PROXY_CONFIG.httpPort}`;
      args.push(`--proxy-server=${proxyUrl}`);
      console.log(`[BrowserService] Using proxy: ${proxyUrl}`);
    }
    
    this.browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args,
    });
    
    console.log('[BrowserService] Puppeteer browser initialized');
  }

  async getPage(): Promise<Page> {
    if (!this.browserAvailable) {
      throw new Error('Browser not available - Chromium not installed');
    }
    if (!this.browser) {
      await this.initBrowser();
    }

    // Reuse page from pool if available
    if (this.pagePool.length > 0) {
      const page = this.pagePool.pop()!;
      return page;
    }

    const page = await this.browser!.newPage();
    
    // Аутентификация прокси
    if (this.useProxy) {
      await page.authenticate({
        username: PROXY_CONFIG.username,
        password: PROXY_CONFIG.password,
      });
    }
    
    // Set realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );
    
    // Установка дополнительных заголовков
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    });
    
    // Block unnecessary resources for speed
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    return page;
  }

  async releasePage(page: Page): Promise<void> {
    try {
      if (this.pagePool.length < this.maxPages) {
        // Очищаем cookies и кэш перед переиспользованием
        const client = await page.target().createCDPSession();
        await client.send('Network.clearBrowserCookies');
        await client.send('Network.clearBrowserCache');
        this.pagePool.push(page);
      } else {
        await page.close();
      }
    } catch (error) {
      try { await page.close(); } catch {}
    }
  }

  async rateLimit(): Promise<void> {
    const now = Date.now();
    const diff = now - this.lastRequest;
    const interval = this.minInterval + Math.random() * 500; // Рандомизация
    if (diff < interval) {
      await new Promise(resolve => setTimeout(resolve, interval - diff));
    }
    this.lastRequest = Date.now();
  }

  async fetchPage(url: string, waitForSelector?: string): Promise<string | null> {
    const page = await this.getPage();
    
    try {
      await this.rateLimit();
      
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 45000,
      });
      
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: 15000 });
      }
      
      const html = await page.content();
      console.log(`[BrowserService] Fetched ${url} (${html.length} bytes)`);
      
      return html;
    } catch (error) {
      console.error(`[BrowserService] Error fetching ${url}:`, error.message);
      return null;
    } finally {
      await this.releasePage(page);
    }
  }

  async extractNextData(url: string): Promise<any | null> {
    const page = await this.getPage();
    
    try {
      await this.rateLimit();
      
      console.log(`[BrowserService] Navigating to ${url}...`);
      
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 45000,
      });
      
      // Ждем загрузки страницы
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Extract __NEXT_DATA__ from script tag
      const nextData = await page.evaluate(() => {
        const script = document.getElementById('__NEXT_DATA__');
        if (script && script.textContent) {
          try {
            return JSON.parse(script.textContent);
          } catch {
            return null;
          }
        }
        return null;
      });
      
      if (nextData) {
        console.log(`[BrowserService] ✓ Extracted __NEXT_DATA__ from ${url}`);
      } else {
        // Попробуем получить данные из window.__INITIAL_STATE__ или другого источника
        const altData = await page.evaluate(() => {
          // @ts-ignore
          if (window.__INITIAL_STATE__) return window.__INITIAL_STATE__;
          // @ts-ignore
          if (window.__PRELOADED_STATE__) return window.__PRELOADED_STATE__;
          // @ts-ignore
          if (window.__NUXT__) return window.__NUXT__;
          return null;
        });
        
        if (altData) {
          console.log(`[BrowserService] ✓ Extracted alternative data from ${url}`);
          return altData;
        }
        
        console.log(`[BrowserService] ✗ No __NEXT_DATA__ found at ${url}`);
      }
      
      return nextData;
    } catch (error) {
      console.error(`[BrowserService] Error extracting data from ${url}:`, error.message);
      return null;
    } finally {
      await this.releasePage(page);
    }
  }

  async fetchHtml(url: string): Promise<string | null> {
    const page = await this.getPage();
    
    try {
      await this.rateLimit();
      
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 45000,
      });
      
      const html = await page.content();
      console.log(`[BrowserService] Fetched HTML from ${url} (${html.length} bytes)`);
      
      return html;
    } catch (error) {
      console.error(`[BrowserService] Error fetching HTML from ${url}:`, error.message);
      return null;
    } finally {
      await this.releasePage(page);
    }
  }

  async closeBrowser(): Promise<void> {
    for (const page of this.pagePool) {
      try { await page.close(); } catch {}
    }
    this.pagePool = [];
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    
    console.log('[BrowserService] Browser closed');
  }

  // Перезапуск браузера с новыми настройками
  async restartBrowser(): Promise<void> {
    await this.closeBrowser();
    await this.initBrowser();
    console.log('[BrowserService] Browser restarted');
  }
}
