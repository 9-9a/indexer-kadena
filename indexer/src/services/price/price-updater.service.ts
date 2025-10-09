import { PriceService } from './price.service';

export class PriceUpdaterService {
  private static instance: PriceUpdaterService;
  private priceService: PriceService;
  private readonly UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly DIA_API_URL =
    'https://api.diadata.org/v1/assetQuotation/Kadena/0x0000000000000000000000000000000000000000';

  private constructor() {
    this.priceService = PriceService.getInstance();
    this.startPriceUpdates();
  }

  public static getInstance(): PriceUpdaterService {
    if (!PriceUpdaterService.instance) {
      PriceUpdaterService.instance = new PriceUpdaterService();
    }
    return PriceUpdaterService.instance;
  }

  private async updatePrice(): Promise<void> {
    try {
      const response = await fetch(this.DIA_API_URL, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'node-fetch',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();

      if (data?.Price === undefined) {
        throw new Error('Price field is missing in API response');
      }

      this.priceService.setKdaUsdPrice(data.Price);
    } catch (error) {
      console.warn('[WARN][INT][INT_API] Failed to update KDA/USD price:', error);
    }
  }

  private startPriceUpdates(): void {
    // Initial update
    this.updatePrice();

    // Schedule periodic updates
    setInterval(() => {
      this.updatePrice();
    }, this.UPDATE_INTERVAL);
  }
}
