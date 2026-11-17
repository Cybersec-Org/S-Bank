import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

export interface ExchangeRate {
  currency: string;
  code: string;
  mid: number;
}

export interface AtmLocation {
  id: string;
  name: string;
  operator: string;
  city: string;
  street: string;
  lat: number;
  lng: number;
  cashAvailable: boolean;
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

// Bezpieczna biała lista Bounding Boxów (south, west, north, east) dla miast w Polsce
const CITY_BBOX: Record<string, { label: string; bbox: [number, number, number, number] }> = {
  warszawa: { label: 'Warszawa', bbox: [52.18, 20.95, 52.27, 21.08] },
  katowice: { label: 'Katowice', bbox: [50.23, 18.98, 50.28, 19.06] },
  krakow: { label: 'Kraków', bbox: [50.03, 19.90, 50.09, 20.00] },
  gliwice: { label: 'Gliwice', bbox: [50.27, 18.64, 50.31, 18.71] },
  dabrowa_gornicza: { label: 'Dąbrowa Górnicza', bbox: [50.30, 19.15, 50.35, 19.25] },
  wroclaw: { label: 'Wrocław', bbox: [51.08, 16.98, 51.14, 17.08] },
  poznan: { label: 'Poznań', bbox: [52.38, 16.88, 52.44, 16.98] },
  gdansk: { label: 'Gdańsk', bbox: [54.33, 18.60, 54.40, 18.69] },
};

const FALLBACK_ATMS: AtmLocation[] = [
  { id: 'atm-ktw-1', name: 'S-Bankomat Galeria Katowicka', operator: 'S-Bank', city: 'Katowice', street: '3 Maja 30', lat: 50.2599, lng: 19.0216, cashAvailable: true },
  { id: 'atm-ktw-2', name: 'Bankomat ING / S-Bank', operator: 'ING Bank Śląski', city: 'Katowice', street: 'Rynek 1', lat: 50.2584, lng: 19.0215, cashAvailable: true },
  { id: 'atm-dg-1', name: 'S-Bankomat Pogoria', operator: 'S-Bank', city: 'Dąbrowa Górnicza', street: 'Jana III Sobieskiego 6', lat: 50.3245, lng: 19.1862, cashAvailable: true },
  { id: 'atm-gli-1', name: 'S-Bankomat Politechnika Śląska', operator: 'S-Bank', city: 'Gliwice', street: 'Akademicka 2A', lat: 50.2886, lng: 18.6774, cashAvailable: true },
  { id: 'atm-waw-1', name: 'S-Bankomat Centrum', operator: 'S-Bank', city: 'Warszawa', street: 'Marszałkowska 104', lat: 52.2297, lng: 21.0122, cashAvailable: true },
  { id: 'atm-krk-1', name: 'Bankomat Euronet / S-Bank', operator: 'Euronet', city: 'Kraków', street: 'Rynek Główny 12', lat: 50.0619, lng: 19.9368, cashAvailable: true },
];

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  private cache: {
    effectiveDate: string;
    rates: ExchangeRate[];
    fetchedAt: number;
  } | null = null;

  private readonly atmCache = new Map<string, { fetchedAt: number; data: AtmLocation[] }>();

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

async getAtms(cityQuery?: string): Promise<{ source: string; city: string; atms: AtmLocation[] }> {
    const normalizedKey = (cityQuery ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ł/g, 'l')
      .replace(/\s+/g, '_');

    if (!normalizedKey) {
      return {
        source: 'sbank_directory',
        city: 'ALL',
        atms: FALLBACK_ATMS,
      };
    }

    const cityConfig = CITY_BBOX[normalizedKey];
    const cityLabel = cityConfig ? cityConfig.label : cityQuery!.trim();

    const cached = this.atmCache.get(normalizedKey);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < this.CACHE_TTL) {
      return {
        source: 'osm_cache',
        city: cityLabel,
        atms: cached.data,
      };
    }

    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`atm in ${cityLabel}`)}&format=jsonv2&addressdetails=1&extratags=1&limit=40`;
      this.logger.log(`Fetching ATMs for ${cityLabel} from OpenStreetMap Nominatim API...`);

      const nomRes = await fetch(nominatimUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'S-Bank-BAiSM-Project/1.0 (https://github.com/Waveus)',
        },
        signal: AbortSignal.timeout(4000),
      });

      if (nomRes.ok) {
        const items = (await nomRes.json()) as any[];
        const mapped: AtmLocation[] = items
          .filter((item) => item.lat && item.lon)
          .map((item) => {
            const addr = item.address ?? {};
            const extratags = item.extratags ?? {};
            const operator =
              extratags.operator ??
              extratags.brand ??
              addr.amenity ??
              item.name ??
              'Sieć Partnerska S-Bank';
            const road = addr.road ?? addr.pedestrian ?? addr.suburb ?? 'Centrum';
            const house = addr.house_number ?? '';

            return {
              id: `osm-${item.place_id}`,
              name: item.name ? `Bankomat ${item.name}` : `Bankomat ${operator}`,
              operator: String(operator),
              city: addr.city ?? addr.town ?? cityLabel,
              street: `${road} ${house}`.trim(),
              lat: Number(item.lat),
              lng: Number(item.lon),
              cashAvailable: true,
            };
          });

        if (mapped.length > 0) {
          this.atmCache.set(normalizedKey, { fetchedAt: now, data: mapped });
          return {
            source: 'osm_nominatim_api',
            city: cityLabel,
            atms: mapped,
          };
        }
      }
    } catch (error) {
      this.logger.warn(`Nominatim OSM failed for ${cityLabel}: ${(error as Error).message}`);
    }

    const cityFallback = FALLBACK_ATMS.filter((a) =>
      a.city.toLowerCase().includes(cityLabel.toLowerCase()),
    );
    return {
      source: 'fallback',
      city: cityLabel,
      atms: cityFallback.length > 0 ? cityFallback : FALLBACK_ATMS,
    };
  }

  getTerms() {
    return {
      version: '2026.11',
      updatedAt: '2026-11-17',
      html: `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Regulamin S-Bank</title>
  <style>
    body { font-family: sans-serif; padding: 16px; line-height: 1.5; color: #1e293b; }
    h1 { font-size: 1.25rem; color: #0f172a; }
    h2 { font-size: 1rem; margin-top: 1rem; }
  </style>
</head>
<body>
  <h1>Regulamin Świadczenia Usług Bankowości Elektronicznej S-Bank</h1>
  <h2>§1. Bezpieczeństwo logowania i operacji</h2>
  <p>1. Logowanie odbywa się przez protokół OpenID Connect z PKCE oraz klucze dostępu Passkeys (WebAuthn).</p>
  <p>2. Przelewy od 1 000,00 PLN wymagają dodatkowego potwierdzenia kluczem Passkey (Step-up Authentication, acr=2).</p>
  <h2>§2. Limity i potwierdzenia kryptograficzne</h2>
  <p>1. Domyślny dzienny limit przelewów wynosi 5 000,00 PLN.</p>
  <p>2. Potwierdzenia przelewów są podpisywane cyfrowo kluczem ECDSA P-256 w module HSM (PKCS#11).</p>
</body>
</html>`,
    };
  }
}