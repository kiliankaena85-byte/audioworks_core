import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export const GEMINI_MEDIA_ADVISOR_MODEL = 'gemini-4-hydrogen';

export const VALID_ADVISOR_DAYPARTS = new Set([
  'morning_prime',
  'daytime_block',
  'evening_drive',
  'weekend_air',
  'traffic_weather',
]);

export const VALID_ADVISOR_STATIONS = new Set([
  'bfm',
  'montecarlo',
  'avtoradio',
  'europaplus',
  'comedy',
  'kommersant',
  'dorozhnoe',
  'retrofm',
  'silverrain',
  'jazz',
]);

export interface GeminiMediaAdvisorRequestInput {
  niche: string;
  segment: string;
  ageCore: string;
  listeningContext: string;
  budgetRub: number;
  spotSeconds: number;
  productNote: string;
}

export interface GeminiMediaAdvisorHint {
  preferredDayparts: string[];
  avoidedDayparts: string[];
  boostedStationIds: string[];
  slotReasonsByStationId: Record<string, string>;
  usedGeminiModel: true;
}

export function buildGeminiMediaAdvisorPrompt(
  input: GeminiMediaAdvisorRequestInput
): string {
  return [
    'Проанализируй рекламную задачу клиента для радиоразмещения FMWorks и верни приоритеты выбора станций и тайм-слотов.',
    `Отраслевая ниша: ${input.niche}`,
    `Сегмент ЦА: ${input.segment}, возраст: ${input.ageCore}, контекст прослушивания: ${input.listeningContext}`,
    `Бюджет клиента: ${Math.round(input.budgetRub)} ₽, хронометраж ролика: ${Math.round(input.spotSeconds)} сек`,
    `Описание продукта / акции клиента: ${input.productNote || 'Не указано дополнительно'}`,
    'Доступные идентификаторы радиостанций: bfm (Business FM), montecarlo (Радио Monte Carlo), avtoradio (Авторадио), europaplus (Европа Плюс), comedy (Comedy Radio), kommersant (Коммерсантъ FM), dorozhnoe (Дорожное Радио), retrofm (Ретро FM), silverrain (Серебряный Дождь), jazz (Радио JAZZ).',
    'Доступные коды тайм-слотов: morning_prime (утренний прайм), daytime_block (дневной блок), evening_drive (вечерний драйв), weekend_air (выходные Сб-Вс), traffic_weather (спонсорство погоды и трафика).',
    'Не упоминай конкретные названия городов в ответах.',
  ].join('\n');
}

export function sanitizeGeminiMediaAdvisorRawJson(
  rawJson: string,
  isReasonClean: (reason: string) => boolean = () => true
): GeminiMediaAdvisorHint {
  const parsed = JSON.parse(rawJson.trim() || '{}') as {
    preferredDayparts?: unknown;
    avoidedDayparts?: unknown;
    boostedStationIds?: unknown;
    stationReasons?: unknown;
  };

  const preferredDayparts = Array.isArray(parsed.preferredDayparts)
    ? parsed.preferredDayparts.filter(
        (d): d is string => typeof d === 'string' && VALID_ADVISOR_DAYPARTS.has(d)
      )
    : [];

  const avoidedDayparts = Array.isArray(parsed.avoidedDayparts)
    ? parsed.avoidedDayparts.filter(
        (d): d is string => typeof d === 'string' && VALID_ADVISOR_DAYPARTS.has(d)
      )
    : [];

  const boostedStationIds = Array.isArray(parsed.boostedStationIds)
    ? parsed.boostedStationIds
        .filter(
          (s): s is string => typeof s === 'string' && VALID_ADVISOR_STATIONS.has(s)
        )
        .slice(0, 3)
    : [];

  const slotReasonsByStationId: Record<string, string> = {};
  if (Array.isArray(parsed.stationReasons)) {
    for (const item of parsed.stationReasons) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as { stationId?: unknown; reason?: unknown };
      if (
        typeof rec.stationId === 'string' &&
        VALID_ADVISOR_STATIONS.has(rec.stationId) &&
        typeof rec.reason === 'string' &&
        rec.reason.trim().length > 0 &&
        isReasonClean(rec.reason)
      ) {
        slotReasonsByStationId[rec.stationId] = rec.reason.trim().slice(0, 95);
      }
    }
  }

  return {
    preferredDayparts,
    avoidedDayparts,
    boostedStationIds,
    slotReasonsByStationId,
    usedGeminiModel: true,
  };
}

export async function requestGeminiMediaAdvisorHint(
  apiKey: string,
  input: GeminiMediaAdvisorRequestInput,
  isReasonClean: (reason: string) => boolean
): Promise<GeminiMediaAdvisorHint> {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const response = await ai.models.generateContent({
    model: GEMINI_MEDIA_ADVISOR_MODEL,
    contents: buildGeminiMediaAdvisorPrompt(input),
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction:
        'Ты главный медиабайер радиоагентства FMWorks. Подбирай самые целевые радиостанции и конкретные временные окна под продукт и портрет ЦА без воды, не упоминая географические города и жаргон звукозаписи. Пиши лаконично по-русски.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          preferredDayparts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '1-2 самых подходящих кода тайм-слотов из списка.',
          },
          avoidedDayparts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Коды тайм-слотов, которые хуже подходят задаче (или пустой массив).',
          },
          boostedStationIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'До 3 наиболее релевантных stationId под продукт и ЦА.',
          },
          stationReasons: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                stationId: { type: Type.STRING },
                reason: {
                  type: Type.STRING,
                  description: 'Короткая причина релевантности (до 9 слов).',
                },
              },
              required: ['stationId', 'reason'],
            },
          },
        },
        required: [
          'preferredDayparts',
          'avoidedDayparts',
          'boostedStationIds',
          'stationReasons',
        ],
      },
    },
  });

  return sanitizeGeminiMediaAdvisorRawJson(response.text ?? '{}', isReasonClean);
}
