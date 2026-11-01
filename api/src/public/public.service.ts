import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';

export interface ExchangeRate {
  currency: string;
  code: string;
  mid: number;
}

@Injectable()
export class PublicService {
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
      const response = await fetch(
        'https://api.nbp.pl/api/exchangerates/tables/A/?format=json',
        { signal: AbortSignal.timeout(5000) },
      );

      if (!response.ok) {
        throw new Error(`NBP API status: ${response.status}`);
      }

      const data = (await response.json()) as Array<{
        effectiveDate: string;
        rates: ExchangeRate[];
      }>;

      const table = data[0];
      
      const ratesWithPln: ExchangeRate[] = [
        { currency: 'polski złoty', code: 'PLN', mid: 1.0 },
        ...table!.rates,
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
      if (this.cache) {
        return {
          source: 'stale_cache',
          effectiveDate: this.cache.effectiveDate,
          rates: this.cache.rates,
        };
      }
      throw new ServiceUnavailableException(
        'Nie udało się pobrać kursów walut z NBP',
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
      throw new BadRequestException(`Nieznana lub nieobsługiwana waluta źródłowa: ${fromCode}`);
    }
    if (!toRateObj) {
      throw new BadRequestException(`Nieznana lub nieobsługiwana waluta docelowa: ${toCode}`);
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