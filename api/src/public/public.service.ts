import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

export interface ExchangeRate {
  currency: string;
  code: string;
  mid: number;
}

const CURRENCY_NAMES_EN: Record<string, string> = {
  PLN: 'Polish Zloty',
  USD: 'US Dollar',
  EUR: 'Euro',
  CHF: 'Swiss Franc',
  GBP: 'Pound Sterling',
  CZK: 'Czech Koruna',
  NOK: 'Norwegian Krone',
  SEK: 'Swedish Krona',
  DKK: 'Danish Krone',
  JPY: 'Japanese Yen',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar',
  HUF: 'Hungarian Forint',
  UAH: 'Ukrainian Hryvnia',
};

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  private cache: {
    effectiveDate: string;
    rates: ExchangeRate[];
    fetchedAt: number;
  } | null = null;

  private readonly CACHE_TTL = 60 * 60 * 1000;

  async getExchangeRates() {
    const now = Date.now();

    if (this.cache && now - this.cache.fetchedAt < this.CACHE_TTL) {
      return {
        source: 'cache',
        effectiveDate: this.cache.effectiveDate,
        rates: this.cache.rates,
      };
    }

    try {
      this.logger.log('Fetching fresh exchange rates from NBP API...');
      const response = await fetch(
        'https://api.nbp.pl/api/exchangerates/tables/A/?format=json',
        { signal: AbortSignal.timeout(5000) },
      );

      if (!response.ok) {
        throw new Error(`NBP API responded with status: ${response.status}`);
      }

      const data = (await response.json()) as Array<{
        effectiveDate: string;
        rates: ExchangeRate[];
      }>;

      const table = data[0];

      const translatedRates: ExchangeRate[] = table!.rates.map((rate) => ({
        code: rate.code,
        mid: rate.mid,
        currency: CURRENCY_NAMES_EN[rate.code] || rate.currency,
      }));

      const ratesWithPln: ExchangeRate[] = [
        { currency: 'Polish Zloty', code: 'PLN', mid: 1.0 },
        ...translatedRates,
      ];

      this.cache = {
        effectiveDate: table!.effectiveDate,
        rates: ratesWithPln,
        fetchedAt: now,
      };

      return {
        source: 'nbp_api',
        effectiveDate: this.cache.effectiveDate,
        rates: this.cache.rates,
      };
    } catch (error) {
      this.logger.error('Failed to fetch exchange rates from NBP API', error);
      if (this.cache) {
        return {
          source: 'stale_cache',
          effectiveDate: this.cache.effectiveDate,
          rates: this.cache.rates,
        };
      }
      throw new ServiceUnavailableException(
        'Failed to fetch exchange rates from NBP API',
      );
    }
  }

  async convertCurrency(amount: number, from: string, to: string) {
    const fromCode = from.toUpperCase();
    const toCode = to.toUpperCase();

    const { effectiveDate, rates } = await this.getExchangeRates();

    const fromRateObj = rates.find((r) => r.code === fromCode);
    const toRateObj = rates.find((r) => r.code === toCode);

    if (!fromRateObj) {
      throw new BadRequestException(`Unsupported source currency: ${fromCode}`);
    }
    if (!toRateObj) {
      throw new BadRequestException(`Unsupported target currency: ${toCode}`);
    }

    const amountInPln = amount * fromRateObj.mid;
    const convertedAmount = amountInPln / toRateObj.mid;

    return {
      amount,
      fromCurrency: fromCode,
      toCurrency: toCode,
      convertedAmount: Number(convertedAmount.toFixed(2)),
      exchangeRate: Number((fromRateObj.mid / toRateObj.mid).toFixed(4)),
      effectiveDate,
    };
  }
}